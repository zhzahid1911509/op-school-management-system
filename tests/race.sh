#!/bin/sh
# Run inside the db container. Each contender opens an independent connection.
set -eu
sql() { psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }
class=$(sql -c "INSERT INTO admission.classes(name,total_seats) VALUES ('Race test',1) RETURNING id")
work=$(mktemp -d)
cleanup() {
  sql -c "DELETE FROM admission.holds WHERE class_id='$class'; DELETE FROM admission.classes WHERE id='$class'" >/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
# Hold the class lock until all contenders are launched.
sql -c "BEGIN; SELECT id FROM admission.classes WHERE id='$class' FOR UPDATE; SELECT pg_sleep(2); COMMIT" >/dev/null &
for i in $(seq 1 20); do
  student=$(printf '%017d' "$i")
  (if sql --set=VERBOSITY=verbose -c "SELECT id FROM admission.reserve('$class','$student',600)" >"$work/$i.log" 2>&1; then
     echo won >"$work/$i.result"
   elif grep -q A0409 "$work/$i.log"; then
     echo full >"$work/$i.result"
   else
     cat "$work/$i.log" >&2
     echo error >"$work/$i.result"
   fi) &
done
wait
[ "$(grep -l '^won$' "$work"/*.result | wc -l)" -eq 1 ]
[ "$(grep -l '^full$' "$work"/*.result | wc -l)" -eq 19 ]
[ "$(sql -c "SELECT held_seats, confirmed_seats, available_seats FROM admission.class_availability WHERE id='$class'")" = '1|0|0' ]
echo 'PASS: 20 contenders, one held seat, 19 conflicts.'
