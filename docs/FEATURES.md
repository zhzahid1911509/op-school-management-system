# Milestone 1 implementation

| File | Responsibility |
|---|---|
| docker-compose.yml | Starts the three services, checks database readiness before launching the API, and mounts persistent database storage. |
| backend/Admission.csproj | Targets .NET 8 and references the Npgsql driver. |
| backend/Program.cs | Validates hold duration, sets the allowed frontend origin, registers the database pool, initializes the admission schema, and serves GET /health. A failed database probe returns HTTP 503. |
| backend/Dockerfile | Restores and publishes the API in an SDK image and runs it as a non-root user in the ASP.NET runtime image. |
| frontend/main.tsx | Requests database status through the configured browser-facing API. Handles timeout, pending, success, and failure, with a retry button. |
| frontend/index.html and style.css | Mount the React page and style a responsive status panel. |
| frontend/package.json and tsconfig.json | Define pinned direct dependencies and type-check TypeScript before Vite builds the UI. |
| frontend/Dockerfile | Builds the static application and serves it with Nginx. |

## Request flow

The original milestone 1 status screen called GET /health. The current admissions screen fetches the class list on startup. The API runs SELECT 1 through its PostgreSQL connection pool and returns readiness and the configured hold duration. A connection failure produces a visible message. The check can be repeated after service recovery. No student information is collected in this milestone.

## Milestone 2 implementation

Database/reservations.sql under backend is copied into the published API. Startup applies it transactionally before accepting traffic. An advisory lock serializes concurrent startup, and existing v0.1.0 data volumes can be reused.

| Operation | Implementation |
|---|---|
| Create a class | Insert a class name and positive capacity into admission.classes. Each shift receives its own UUID. |
| Hold a seat | admission.reserve locks the class, expires its stale holds, checks student eligibility and available capacity, then inserts a HELD row. The caller supplies the configured duration in seconds. |
| Confirm or cancel | admission.transition locks the same class, verifies ownership and expiry, and changes one row. Repeating the same successful transition returns the existing result. |
| Automatic expiry | ExpiryWorker runs admission.expire_due at startup and roughly once per second. Each sweep handles up to 100 eligible classes and skips locked classes for the next sweep. |
| Read status and counts | application_status and class_availability evaluate the deadline at query time. An expired seat appears available even before the next sweep. |
| Validation | tests/reservations.sql checks lifecycle rules. tests/race.sh sends 20 independent transactions for one seat. |

On restart, overdue rows are eligible for the first sweep. The HTTP handlers map database error codes A0400, A0403, A0404, and A0409 to the corresponding client statuses.

## Milestone 3 HTTP API

AdmissionEndpoints.cs maps the eight routes below. All SQL uses bound parameters. Class reads use class_availability and hold reads use application_status so expiry is visible between worker sweeps. Reservation passes the configured HOLD_DURATION_SECONDS into the same database function exercised by milestone 2. Dates are serialized in UTC.

| Method and path | Student header | Success |
|---|---|---|
| POST /classes | — | 201 with id, name, totalSeats. The body accepts name and totalSeats. |
| GET /classes | — | 200 with an array of class summaries. |
| GET /classes/{classId} | — | 200 with id, name, totalSeats, heldSeats, confirmedSeats and availableSeats. |
| POST /classes/{classId}/holds | Required | 201 with holdId, classId, studentId, status and expiresAt. Full class or duplicate active admission returns 409. |
| GET /holds/{holdId} | — | 200 with holdId, classId, status and expiresAt. |
| POST /holds/{holdId}/confirm | Required | 200 with holdId and status. A successful replay returns CONFIRMED. |
| DELETE /holds/{holdId} | Required | 204 with an empty body. |
| GET /me/holds | Required | 200 with an array of holdId, classId, className, status and expiresAt for this student. |

ApiErrors.cs translates malformed inputs and expected PostgreSQL domain errors to JSON with an error field. Invalid fields, identifiers or headers return 400, another owner's mutation returns 403, missing resources return 404, and expiry, full classes and incompatible transitions return 409. A transient database failure returns 503.

compose.contract.yml runs the API with a disposable database and a Python standard-library HTTP client. See README.md for test commands.

## Milestone 4 browser workflows

| Source | Responsibility |
|---|---|
| frontend/main.tsx | Mounts the React application. |
| frontend/App.tsx | Student selection, admin class form, seat counts, guardian actions, history and countdowns. |
| frontend/api.ts | Uses the configured API URL, attaches student identity to scoped requests, handles JSON and empty 204 responses, and presents request or network errors. |
| frontend/style.css | Responsive forms and class cards, readable status messages, keyboard focus and disabled actions. |
| frontend/tests/App.test.tsx | Exercises the rendered UI with simulated API responses for payment, cancellation, reopening, expiry, class creation, conflict recovery, polling and identity switching. |

The selected 17-digit student number is stored as text. Each selection creates a fresh workspace and fetches that student's history. Admission records remain in PostgreSQL. The frontend polls classes and history three seconds after each poll completes, refreshes on focus and after every mutation, and ignores superseded responses. The countdown derives from the UTC deadline and disables payment locally at expiry. The backend checks eligibility again when processing each request.

The interface shows server conflicts even when another guardian claims the final seat between refreshes. Payment simulates the assignment's successful fee payment by calling the confirmation endpoint.

## Final acceptance

| Check | Expected observation |
|---|---|
| Two API processes, 50 simultaneous students, five seats | Exactly five 201 responses and 45 conflicts. Both processes report five held seats. |
| Duplicate student and concurrent confirmation retries | One active hold across both processes, then one confirmed seat. |
| Confirmation at expiry while another applicant requests the seat | Either the original payment succeeds or the competing applicant obtains the released seat. Final occupied count is one. |
| Autonomous worker | A direct read of the stored hold shows EXPIRED after its deadline without any admission API request. |
| Chromium | Admin creates a class, guardian applies, refreshes, pays and sees a confirmed seat in the UI. |
| Compose persistence | The same class UUID, hold UUID, confirmed count and history are recovered after down/up. |

The Windows runner tests/acceptance.cmd executes these checks in an isolated project. tests/http_contract.py exercises HTTP concurrency. tests/browser_flow.py uses Chromium. tests/persistence.py stores the fixture identifiers independently of PostgreSQL and reads them back after the database and API containers have been recreated.
