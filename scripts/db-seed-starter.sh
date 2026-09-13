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
  docker exec -i org_vehicle_management-postgres-1 psql -U fleetops -d fleetops \
    < "$ROOT/database/seed_demo_accounts.sql"
  docker exec -i org_vehicle_management-postgres-1 psql -U fleetops -d fleetops \
    < "$ROOT/database/seed_maintenance.sql"
else
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT/database/seed_starter.sql"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT/database/seed_demo_accounts.sql"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT/database/seed_maintenance.sql"
fi

echo "Starter + demo accounts + maintenance applied (admin123 / emp123 / driver123)."
