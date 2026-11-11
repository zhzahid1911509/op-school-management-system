# Assumptions and Design Decisions

## Scope and configuration

- Each class record represents one admission group/shift. Names may repeat; UUIDs are internal keys, while public IDs use `c_12345` and `h_12345`. Existing UUID paths remain supported. Each public-ID prefix has 90,000 possible five-digit codes; exhaustion returns a conflict.
- As required, there is no login or real payment gateway. A 17-digit birth registration number is supplied through `X-Student-Id`; this identifies the applicant but is not authentication. Payment is simulated by confirming a hold.
- The default UI runs at `http://localhost:3000` and the API at `http://localhost:8080`. `VITE_API_URL` sets the browser-facing API URL at frontend build time; changing it requires rebuilding. `ConnectionStrings__Admission` configures the database connection.
- `HOLD_DURATION_SECONDS` defaults to 600 and must be positive. Database time determines expiry. At the deadline, a hold is expired; cancellation and expiry retain history and allow a new application. Confirmation permanently occupies the seat.
- Bangla is the default language; the saved language preference can select English. Bengali input digits are normalized to ASCII. Administrator-entered class names are preserved.
- PostgreSQL storage uses a named Docker volume. Ordinary `docker compose down` preserves records; removing the volume deletes them. The application database account owns the schema so startup can initialize it. `GET /health` is an additional readiness endpoint.

## Bonus: two backend processes, one capacity guarantee

### Setup

`compose.contract.yml` starts two independent API processes: `backend` listens on port **8080**, and `replica` on port **8081**. Both use the same PostgreSQL database and schema through the shared connection configuration. These are container-network ports; the test stack does not publish them to the host. The contract-test container calls both services directly.

The invariant for each class is:

```text
heldSeats + confirmedSeats <= totalSeats
```

The guarantee comes from database transactions and locks shared by both processes. It does not depend on a C# in-memory lock, a frontend seat count or requests reaching the same API instance.

### How reservation stays safe

`admission.reserve` in `backend/Database/reservations.sql` performs the following within one database transaction:

1. Lock the target class row with `SELECT ... FOR UPDATE`.
2. After acquiring that lock, read `clock_timestamp()` and expire overdue holds for the class.
3. Reject an existing HELD or CONFIRMED application for the same student and class.
4. Count HELD and CONFIRMED records. Reject with HTTP 409 if capacity is already occupied.
5. Otherwise insert one HELD record. The lock remains held until the transaction commits or rolls back.

For example, if two requests reach different API processes for the final seat, only one can hold that class-row lock. The other waits. After the first request commits, the waiting request acquires the lock and its subsequent reads see the committed reservation under PostgreSQL's default READ COMMITTED isolation. It finds the class full and receives 409. A failed transaction rolls back its changes.

The capacity check and insertion therefore cannot interleave for the same class. Requests for different classes use different class-row locks, although public-ID allocation also briefly uses a shared per-prefix lock.

### Confirmation, cancellation and expiry use the same rule

- `admission.transition` locks the parent class before reading or changing the application, checks ownership and rejects an expired HELD record. Confirmation changes HELD to CONFIRMED in the existing row, so occupied capacity does not increase.
- Repeating a successful confirmation for the same owner returns CONFIRMED without creating another record or consuming another seat. Repeating cancellation is also safe for the same owner and terminal state.
- Cancellation and expiry reduce occupied capacity. `ExpiryWorker` calls `admission.expire_due()` at startup and approximately every second, without requiring an API call. Each sweep locks eligible class rows before updating holds and uses `SKIP LOCKED` to defer busy classes. Two running workers can safely share this job.
- Reservation also expires overdue holds while holding the class lock. Read views evaluate deadlines using database time, so expired seats appear available even between worker sweeps.
- The partial unique index `one_admission_per_student` additionally prevents more than one HELD/CONFIRMED record per student and class. This enforces duplicate prevention; the class-row locking protocol enforces capacity.

Starting from valid data, reservation is the only operation that increases occupancy, and it does so only after a serialized capacity check. Confirmation preserves occupancy; cancellation and expiry decrease it. This is why the invariant holds across both API processes.

### Boundary of the guarantee

All application seat writes must go through `reserve`, `transition` or `expire_due` using the documented isolation and lock order. Direct administrative SQL that inserts holds or reduces class capacity can bypass this protocol; there is no cross-row CHECK constraint that independently enforces capacity. The application exposes no capacity-reduction endpoint. Lock acquisition order determines allocation; strict arrival-time fairness is not promised.

### Reproducible verification

`tests/http_contract.py` includes these checks against the two-process stack:

| Scenario | Assertion in the test |
|---|---|
| 50 concurrent applicants, alternated between both APIs, five seats | Exactly five 201 responses and 45 conflicts; both APIs report five held seats and zero available seats. |
| Same student applies through both APIs concurrently | One successful hold and one conflict. |
| Concurrent confirmation retries through both APIs | Both return CONFIRMED, but only one seat is confirmed. |
| Confirmation near expiry races with another applicant | Either the original confirmation succeeds or the replacement hold succeeds; final occupied capacity remains one. |

`tests/worker.sh` additionally checks stored expiry without an admission API request. `tests/persistence.py` checks recovery after container removal and recreation.

From the project root in PowerShell, run the complete isolated suite:

```powershell
.\tests\acceptance.cmd
```

Successful completion prints:

```text
PASS: component, HTTP, database, browser and persistence checks completed.
```

**Verification status:** These are implemented assertions and expected outcomes, not a claim that the live suite has already passed. Docker and the .NET SDK were unavailable in the preparation environment. A successful target-machine acceptance run is still required to verify the implementation end to end.
