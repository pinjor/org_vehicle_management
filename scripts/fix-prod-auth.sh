#!/usr/bin/env bash
# One-shot fix for production VMs that already have a DB (skipped db-init).
# Drops broken Supabase auth trigger + seeds demo login accounts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-fleetops}"
PGDATABASE="${PGDATABASE:-fleetops}"
export PGPASSWORD="${PGPASSWORD:-fleetops}"

run() {
  local file="$1"
  if [ -n "${DOCKER_PG_CONTAINER:-}" ]; then
    docker exec -i "$DOCKER_PG_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" < "$file"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'postgres'; then
    local c
    c=$(docker ps --format '{{.Names}}' | grep -E 'postgres|fleetops' | head -1)
    docker exec -i "$c" psql -U "$PGUSER" -d "$PGDATABASE" < "$file"
  else
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$file"
  fi
}

echo "Applying auth patches…"
run "$ROOT/database/99_local_patches.sql"
echo "Seeding demo accounts…"
run "$ROOT/database/seed_demo_accounts.sql"
echo "Done. Demo: 1711000001/admin123 · 1712000003/emp123 · 1712000002/driver123"
