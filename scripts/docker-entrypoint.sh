#!/usr/bin/env bash
set -euo pipefail

export PGHOST="${PGHOST:-postgres}"
export PGUSER="${PGUSER:-fleetops}"
export PGDATABASE="${PGDATABASE:-fleetops}"
export PGPASSWORD="${PGPASSWORD:-fleetops}"

echo "Waiting for PostgreSQL at ${PGHOST}…"
for i in $(seq 1 60); do
  if pg_isready -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! pg_isready -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
  echo "PostgreSQL not ready after 60s" >&2
  exit 1
fi

if [ "${INIT_DB:-true}" = "true" ]; then
  ROSTER=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -tAc "select to_regclass('public.user_roster')" || true)
  LOOKUP=$(psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -tAc "select to_regprocedure('public.lookup_roster_phone(text)')" || true)
  if [ -z "$ROSTER" ] || [ -z "$LOOKUP" ]; then
    echo "Database missing roster schema — running migrations and seed…"
    bash /app/scripts/db-init.sh
  else
    echo "Database already initialized — skipping db-init"
  fi
fi

echo "Starting FleetOps on ${HOST:-0.0.0.0}:${PORT:-3000}…"
exec "$@"
