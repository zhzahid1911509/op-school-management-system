#!/bin/sh
# Verify expiry is persisted with no admission API request or manual sweep.
set -eu
sql() { psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }
class=$(sql -c "INSERT INTO admission.classes(name,total_seats) VALUES ('Worker test',1) RETURNING id")
cleanup() {
  sql -c "DELETE FROM admission.holds WHERE class_id='$class'; DELETE FROM admission.classes WHERE id='$class'" >/dev/null
}
trap cleanup EXIT
hold=$(sql -c "SELECT id FROM admission.reserve('$class','00000000000000001',1)")
for attempt in $(seq 1 15); do
  sleep 1
  if [ "$(sql -c "SELECT status FROM admission.holds WHERE id='$hold'")" = 'EXPIRED' ]; then
    echo 'PASS: worker persisted expiry without an admission API call.'
    exit 0
  fi
done
echo 'FAIL: hold still active after 15 seconds. Inspect backend logs.' >&2
exit 1
