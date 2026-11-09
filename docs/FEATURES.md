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

## Next milestone

Create class and application tables and implement allocation, confirmation, cancellation, and expiry under PostgreSQL transaction locks. The initialization created here prepares their schema.
