@echo off
setlocal
pushd "%~dp0.."
set "compose=docker compose -p admission-check-%RANDOM%-%RANDOM% -f compose.contract.yml --profile browser"
echo Building backend and frontend...
%compose% build backend replica frontend || goto fail
docker build --target build -t school-admission-ui-tests ./frontend || goto fail
docker run --rm school-admission-ui-tests npm test || goto fail
%compose% up -d db backend replica frontend || goto fail
%compose% run --rm contract || goto fail
%compose% exec -T db psql -X -U postgres -d admission -v ON_ERROR_STOP=1 -f /checks/reservations.sql || goto fail
%compose% exec -T db sh /checks/worker.sh || goto fail
echo Building the Chromium test driver...
%compose% --progress plain build browser || goto fail
%compose% run --rm browser || goto fail
%compose% run --rm contract python /suite/persistence.py seed || goto fail
%compose% down || goto fail
%compose% up -d backend replica || goto fail
%compose% run --rm contract python /suite/persistence.py verify || goto fail
%compose% down -v || goto fail
echo PASS: component, HTTP, database, browser and persistence checks completed.
popd
exit /b 0
:fail
echo Acceptance failed. Inspect the output above and the isolated stack:
echo %compose% logs
echo To remove its test containers and volumes after inspection:
echo %compose% down -v
popd
exit /b 1
