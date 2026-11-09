# School Admission System

Guardians can reserve a seat in a class and shift, pay the simulated admission fee, cancel a hold, and view application history. The admin workspace creates classes and sets capacity. The React UI uses an ASP.NET Core 8 JSON API backed by PostgreSQL 16.

## Build and run

1. Install Docker with Compose v2. On Windows, start Docker Desktop using Linux containers. The first build needs internet access for images and packages.
2. Open a terminal in the project folder containing docker-compose.yml. Make ports 3000 and 8080 available.
3. Run `docker compose up`. To rebuild after updating source, run `docker compose up --build`. For a detached run add `-d`. To build without starting, run `docker compose build`.
4. Open http://localhost:3000. The API is at http://localhost:8080 and its database health check is at http://localhost:8080/health.
5. Stop with `docker compose down`. The named PostgreSQL volume survives down/up when you use the same project name. Inspect startup with `docker compose ps` and `docker compose logs db backend frontend`.

## Try the workflow

In **School admin**, create **Class 6 – Morning Shift** with one seat. In **Admissions**, enter `00000000000000001`, choose **Use this student**, and click **Apply**. Refresh or reopen the page to recover the hold. **Pay admission fee** converts it to a confirmed admission. To test cancellation, cancel before confirming, then reapply.

For a short expiry demo, place `HOLD_DURATION_SECONDS=10` in a root .env file and run `docker compose up -d --build`. A new unpaid hold should expire, disable payment and release the seat. Seat counts refresh every few seconds. The default duration is 600 seconds.

## Configuration

| Variable | Use |
|---|---|
| HOLD_DURATION_SECONDS | Positive number of seconds for new holds, default 600. |
| VITE_API_URL | Browser-accessible API origin, default http://localhost:8080. Rebuild the frontend after changing it. |
| FRONTEND_ORIGIN | Allowed browser origin, default http://localhost:3000. |
| POSTGRES_PASSWORD | Local database password. Set before first volume initialization. |
| ADMISSION_CONNECTION_STRING | Optional complete Npgsql connection string, default uses the bundled database. |

## Run acceptance tests

On Windows with Docker Desktop running, run from the project root:

```cmd
tests\acceptance.cmd
```

The script creates an isolated Compose project with two API processes, separate ports, one database, and a test frontend. It runs six frontend component tests, eight HTTP tests, SQL lifecycle checks, autonomous worker expiry, a real Chromium admission flow, and a database restart check. It stops at the first failure and prints diagnostic and cleanup commands. The test stack has no published host ports. Its database volume is removed after success.

On Linux or macOS use the following sequence. Run commands in order and inspect any failure before continuing.

```sh
dc() { docker compose -p school-admission-acceptance -f compose.contract.yml --profile browser "$@"; }
docker build --target build -t school-admission-ui-tests ./frontend
docker run --rm school-admission-ui-tests npm test
dc build backend replica frontend browser
dc up -d db backend replica frontend
dc run --rm contract
dc exec -T db psql -X -U postgres -d admission -v ON_ERROR_STOP=1 -f /checks/reservations.sql
dc exec -T db sh /checks/worker.sh
dc run --rm browser
dc run --rm contract python /suite/persistence.py seed
dc down
dc up -d backend replica
dc run --rm contract python /suite/persistence.py verify
dc down -v
```

For the frontend alone with Node.js 22, run `npm ci`, `npm run build`, and `npm test` inside frontend. The eight HTTP tests run against real services with a 15-second hold duration. The component tests use simulated API responses.

## Implementation and submission

- docs/FEATURES.md explains the features and source files.
- ASSUMPTIONS.md records the identity, expiry, concurrency and deployment decisions.
- AI_USAGE.md describes AI contributions and corrections.

For a new checkout from GitHub, run the normal Docker command and then the acceptance script. After the tests pass, push the incremental commits to your public repository and submit its URL through the assignment form before the deadline. Record the submitted commit using `git rev-parse HEAD`. Keep the confidential assignment PDF out of the repository.

### Browser image build on Windows

From PowerShell in the repository root, use the following to build the Chromium test image separately with plain logs, then run acceptance:

```powershell
docker compose -f compose.contract.yml --profile browser --progress plain build browser
if ($LASTEXITCODE -eq 0) { .\tests\acceptance.cmd }
```

The test driver is pinned in tests/browser/package-lock.json and uses the Chromium installed in the Playwright image. The build needs access to the Docker image registries and registry.npmjs.org. A slow network may pause between Docker output lines. The normal runner builds the browser driver after the HTTP and database checks and reuses cached layers.
