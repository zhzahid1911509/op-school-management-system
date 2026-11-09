# School Admission System

Milestone 2 adds the transactional PostgreSQL reservation lifecycle and automatic expiry. The frontend still displays service health. The admission HTTP endpoints follow in milestone 3.

## Run on Windows, macOS, or Linux

1. Install Docker with the Compose v2 plugin. On Windows start Docker Desktop using Linux containers. Check `docker version` and `docker compose version`. The first build needs internet access for images and packages.
2. Extract the ZIP and open a terminal in the school-admission folder containing docker-compose.yml. Keep ports 3000 and 8080 available.
3. Run `docker compose up --build`. This builds the release API and static UI, starts PostgreSQL and installs the reservation tables, functions, and views. Leave the terminal open. For later runs use `docker compose up`.
4. Open http://localhost:3000 and press **Check connection**. The screen should report a connected API and PostgreSQL, and the configured duration (600 seconds by default). Visit http://localhost:8080/health to see the same result as JSON.
5. To stop, press Ctrl+C and run `docker compose down`. The database volume survives a normal down/up cycle.

## Build and verify

Build without starting with `docker compose build`. For a detached run use `docker compose up -d --build`. Inspect services with `docker compose ps` and errors with `docker compose logs db backend frontend`. If the page loads while the backend is still starting, click **Check connection** again.

Inspect schema initialization with:

```sh
docker compose exec db psql -U admission -d admission -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admission';"
```

The expected output contains one row named admission. The health endpoint should return HTTP 200 while PostgreSQL is reachable. Run `docker compose stop db` and retry the UI to exercise the unavailable state, then `docker compose start db` and retry once the database is ready. These are infrastructure smoke checks. Database lifecycle and concurrency checks are described below.

## Configuration

The defaults work without a configuration file. To override them, create a .env beside docker-compose.yml and set the relevant variables.

| Variable | Default or purpose |
|---|---|
| HOLD_DURATION_SECONDS | 600, must be positive. Reported on the status screen and reserved for the hold workflow. |
| POSTGRES_PASSWORD | admission_local, for local evaluation. Set before creating the volume. |
| ADMISSION_CONNECTION_STRING | Optional complete Npgsql connection string. Defaults to the bundled db service. |
| VITE_API_URL | Browser-accessible API base URL, default http://localhost:8080. Rebuild the frontend after changing it. |
| FRONTEND_ORIGIN | Allowed browser origin, default http://localhost:3000. Match the exact origin used in the browser. |

See docs/FEATURES.md for the file-by-file implementation. The archive includes the local main branch and incremental commits. Use `git log --oneline` to inspect them.


## Run milestone 2 checks

Start the stack with `docker compose up -d --build` and wait for the health endpoint to report ready. In PowerShell, from the project root:

```powershell
Get-Content -Raw tests/reservations.sql | docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U admission -d admission
Get-Content -Raw tests/race.sh | docker compose exec -T db sh
```

On Linux or macOS:

```sh
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U admission -d admission < tests/reservations.sql
docker compose exec -T db sh < tests/race.sh
```

The lifecycle check ends with ROLLBACK. The race check expects one winner and nineteen conflicts. Both clean up their fixtures. These tests exercise the database layer. HTTP contract tests follow the endpoint implementation.

To verify the live worker, repeat the race-script command above using `tests/worker.sh` in place of `tests/race.sh`. This creates a one-second hold, waits up to fifteen seconds, and reads the stored status to confirm automatic expiry.

Verification during development: the migration ran twice and the transaction-based lifecycle assertions passed in PGlite. The native multi-connection race and live worker checks require the running Docker stack.
