#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-fleetops}"
PGDATABASE="${PGDATABASE:-fleetops}"
export PGPASSWORD="${PGPASSWORD:-fleetops}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'org_vehicle_management-postgres-1'; then
  docker exec -i org_vehicle_management-postgres-1 psql -U fleetops -d fleetops \
    < "$ROOT/database/seed_starter.sql"
else
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT/database/seed_starter.sql"
fi

echo "Starter seed applied (admin +8801711000001, employees, drivers, vehicles)."
