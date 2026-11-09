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

Opening the frontend triggers GET /health. The API runs SELECT 1 through its PostgreSQL connection pool and returns readiness and the configured hold duration. A connection failure produces a visible message. The check can be repeated after service recovery. No student information is collected in this milestone.

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

On restart, overdue rows are eligible for the first sweep. The API's future HTTP handlers can map database error codes A0400, A0403, A0404, and A0409 to the corresponding client statuses.
