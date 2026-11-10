"""Exercise the real HTTP service against an isolated PostgreSQL database."""
import concurrent.futures
import json
import threading
import os
import time
import unittest
import uuid
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = os.getenv("API_BASE_URL", "http://backend:8080")
SECOND = os.getenv("SECOND_API_URL", "http://replica:8081")
OWNER = "00000000000000001"
OTHER = "00000000000000002"


def request(method, path, *, student=None, payload=None, raw=None, base=BASE):
    headers = {}
    if student is not None:
        headers["X-Student-Id"] = student
    if payload is not None:
        raw = json.dumps(payload).encode()
    if raw is not None:
        headers["Content-Type"] = "application/json"
    req = Request(base + path, data=raw, headers=headers, method=method)
    try:
        response = urlopen(req, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        return response.status, json.loads(body) if body else None


def wait_ready(base):
    for _ in range(90):
        try:
            if request("GET", "/health", base=base)[0] == 200:
                return
        except (URLError, OSError):
            pass
        time.sleep(1)
    raise RuntimeError(f"{base} failed to become ready")


class Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for base in (BASE, SECOND):
            wait_ready(base)

    def call(self, expected, method, path, **kwargs):
        status, body = request(method, path, **kwargs)
        self.assertEqual(expected, status, (method, path, body))
        return body

    def create_class(self, seats=1):
        name = "Class 6 Morning " + uuid.uuid4().hex[:8]
        data = self.call(201, "POST", "/classes", payload={"name": name, "totalSeats": seats})
        self.assertEqual((name, seats), (data["name"], data["totalSeats"]))
        self.assertRegex(data["id"], r"^c_[1-9][0-9]{4}$")
        return data["id"], name

    def test_class_and_confirmation(self):
        cid, name = self.create_class()
        path = f"/classes/{cid}"
        rows = self.call(200, "GET", "/classes")
        initial = self.call(200, "GET", path)
        self.assertIn(initial, rows)
        self.assertEqual((name, 1, 0, 0, 1), tuple(initial[k] for k in
                         ("name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats")))
        hold = self.call(201, "POST", path + "/holds", student=OWNER)
        self.assertEqual((cid, OWNER, "HELD"), (hold["classId"], hold["studentId"], hold["status"]))
        self.assertRegex(hold["holdId"], r"^h_[1-9][0-9]{4}$")
        deadline = datetime.fromisoformat(hold["expiresAt"])
        self.assertGreater(deadline, datetime.now(timezone.utc))
        hp = "/holds/" + hold["holdId"]
        self.assertEqual(hold["expiresAt"], self.call(200, "GET", hp)["expiresAt"])
        self.call(409, "POST", path + "/holds", student=OWNER)
        self.call(403, "POST", hp + "/confirm", student=OTHER)
        for _ in range(2):
            confirmed = self.call(200, "POST", hp + "/confirm", student=OWNER)
            self.assertEqual(("CONFIRMED", hold["holdId"]), (confirmed["status"], confirmed["holdId"]))
        counts = self.call(200, "GET", path)
        self.assertEqual((0, 1, 0), tuple(counts[k] for k in ("heldSeats", "confirmedSeats", "availableSeats")))
        history = self.call(200, "GET", "/me/holds", student=OWNER)
        row = next(h for h in history if h["holdId"] == hold["holdId"])
        self.assertEqual((cid, name, "CONFIRMED", hold["expiresAt"]),
                         tuple(row[k] for k in ("classId", "className", "status", "expiresAt")))
        other = self.call(200, "GET", "/me/holds", student=OTHER)
        self.assertNotIn(hold["holdId"], [h["holdId"] for h in other])

    def test_cancel_releases_seat(self):
        cid, _ = self.create_class()
        path = f"/classes/{cid}/holds"
        hold = self.call(201, "POST", path, student=OWNER)
        hp = "/holds/" + hold["holdId"]
        self.call(403, "DELETE", hp, student=OTHER)
        self.assertIsNone(self.call(204, "DELETE", hp, student=OWNER))
        self.assertEqual("CANCELLED", self.call(200, "GET", hp)["status"])
        self.call(201, "POST", path, student=OTHER)

    def test_expiry_releases_seat(self):
        cid, _ = self.create_class()
        path = f"/classes/{cid}/holds"
        hold = self.call(201, "POST", path, student=OWNER)
        delay = datetime.fromisoformat(hold["expiresAt"]).timestamp() - time.time()
        self.assertLess(delay, 20, "Use the isolated 15-second test configuration")
        time.sleep(max(0, delay) + 0.25)
        hp = "/holds/" + hold["holdId"]
        self.assertEqual("EXPIRED", self.call(200, "GET", hp)["status"])
        self.call(409, "POST", hp + "/confirm", student=OWNER)
        self.call(201, "POST", path, student=OWNER)

    def test_input_errors(self):
        for value in (None, "", "123", "x" * 17):
            self.call(400, "GET", "/me/holds", student=value)
        for body in ({"name": "", "totalSeats": 2}, {"name": "Class", "totalSeats": 0},
                     {"name": "Class\x006", "totalSeats": 1}):
            self.call(400, "POST", "/classes", payload=body)
        self.call(400, "POST", "/classes", raw=b"{")
        self.call(400, "GET", "/classes/bad-id")
        unknown = str(uuid.uuid4())
        self.call(404, "GET", "/classes/" + unknown)
        self.call(404, "GET", "/holds/" + unknown)
        self.call(404, "POST", f"/classes/{unknown}/holds", student=OWNER)

    def test_last_seat_race(self):
        cid, _ = self.create_class()
        def apply(i):
            return request("POST", f"/classes/{cid}/holds", student=f"{i:017d}")[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            statuses = list(pool.map(apply, range(100, 120)))
        self.assertEqual([201] + [409] * 19, sorted(statuses))
        detail = self.call(200, "GET", f"/classes/{cid}")
        self.assertEqual((1, 0, 0), tuple(detail[k] for k in ("heldSeats", "confirmedSeats", "availableSeats")))

    def test_fifty_requests_across_two_processes(self):
        cid, _ = self.create_class(5)
        gate = threading.Barrier(50, timeout=20)
        def apply(i):
            gate.wait()
            return request("POST", f"/classes/{cid}/holds", base=(BASE, SECOND)[i % 2],
                           student=f"{300+i:017d}")[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as pool:
            statuses = list(pool.map(apply, range(50)))
        self.assertEqual([201] * 5 + [409] * 45, sorted(statuses))
        for base in (BASE, SECOND):
            detail = self.call(200, "GET", f"/classes/{cid}", base=base)
            self.assertEqual((5, 0, 0), tuple(detail[k] for k in ("heldSeats", "confirmedSeats", "availableSeats")))

    def test_duplicate_student_and_payment_retries_across_processes(self):
        cid, _ = self.create_class(2)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda base: request("POST", f"/classes/{cid}/holds",
                                      student=OWNER, base=base), [BASE, SECOND]))
        self.assertEqual([201, 409], sorted(code for code, _ in responses))
        hold = next(body for code, body in responses if code == 201)
        path = "/holds/" + hold["holdId"] + "/confirm"
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda base: request("POST", path, student=OWNER, base=base), [BASE, SECOND]))
        self.assertEqual([(200, "CONFIRMED")] * 2, [(code, body["status"]) for code, body in results])
        detail = self.call(200, "GET", f"/classes/{cid}")
        self.assertEqual((0, 1, 1), tuple(detail[k] for k in ("heldSeats", "confirmedSeats", "availableSeats")))

    def test_confirmation_at_expiry_with_competing_applicant(self):
        cid, _ = self.create_class()
        path = f"/classes/{cid}/holds"
        hold = self.call(201, "POST", path, student=OWNER)
        deadline = datetime.fromisoformat(hold["expiresAt"]).timestamp()
        def confirm():
            time.sleep(max(0, deadline - time.time() - 0.015))
            return request("POST", f"/holds/{hold['holdId']}/confirm", student=OWNER)[0]
        def replace():
            time.sleep(max(0, deadline - time.time() + 0.050))
            return request("POST", path, student=OTHER, base=SECOND)[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            payment = pool.submit(confirm)
            application = pool.submit(replace)
            outcome = payment.result(), application.result()
        self.assertIn(outcome, [(200, 409), (409, 201)])
        detail = self.call(200, "GET", f"/classes/{cid}", base=SECOND)
        counts = tuple(detail[k] for k in ("heldSeats", "confirmedSeats", "availableSeats"))
        self.assertEqual((0, 1, 0) if outcome[0] == 200 else (1, 0, 0), counts)


if __name__ == "__main__":
    unittest.main(verbosity=2)
