"""Run seed and verify in separate containers across a real Compose down/up."""
import json
import sys
from pathlib import Path
from http_contract import request, wait_ready, BASE, OWNER


def call(expected, method, path, **kwargs):
    status, body = request(method, path, **kwargs)
    if status != expected:
        raise RuntimeError((method, path, status, body))
    return body


wait_ready(BASE)
fixture = Path("/fixtures/restart.json")
if sys.argv[1:] == ["seed"]:
    room = call(201, "POST", "/classes", payload={"name": "Restart acceptance", "totalSeats": 1})
    hold = call(201, "POST", f"/classes/{room['id']}/holds", student=OWNER)
    call(200, "POST", f"/holds/{hold['holdId']}/confirm", student=OWNER)
    fixture.write_text(json.dumps([room["id"], hold["holdId"]]))
elif sys.argv[1:] == ["verify"]:
    cid, hid = json.loads(fixture.read_text())
    room = call(200, "GET", f"/classes/{cid}")
    assert (room["confirmedSeats"], room["availableSeats"]) == (1, 0)
    assert call(200, "GET", f"/holds/{hid}")["status"] == "CONFIRMED"
    assert any(h["holdId"] == hid and h["status"] == "CONFIRMED"
               for h in call(200, "GET", "/me/holds", student=OWNER))
    print("PASS: original class, confirmed seat and student history survived down/up.")
else:
    raise SystemExit("Expected seed or verify")
