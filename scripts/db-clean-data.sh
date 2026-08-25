#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export PGPASSWORD="${PGPASSWORD:-fleetops}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-fleetops}"
PGDATABASE="${PGDATABASE:-fleetops}"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1)

MODE="${1:-}"

echo "Waiting for PostgreSQL…"
ready=0
for _ in $(seq 1 30); do
  if "${PSQL[@]}" -c "select 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Cannot connect to PostgreSQL at $PGHOST:$PGPORT/$PGDATABASE" >&2
  echo "Start it first: npm run db:up" >&2
  exit 1
fi

if [ "$MODE" = "--keep-fleet" ]; then
  echo "Clearing requests, users, and transactions (keeping vehicles/drivers/locations)…"
  "${PSQL[@]}" -f database/clean_data_keep_fleet.sql
else
  echo "Clearing all data: requests, users, roster, fleet seed, departments, locations…"
  "${PSQL[@]}" -f database/clean_data.sql
fi

echo "Done. Tables unchanged — only rows removed."
