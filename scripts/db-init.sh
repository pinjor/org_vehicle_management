#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export PGPASSWORD="${PGPASSWORD:-fleetops}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-fleetops}"
PGDATABASE="${PGDATABASE:-fleetops}"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1)

echo "Waiting for PostgreSQL…"
for i in $(seq 1 30); do
  if "${PSQL[@]}" -c "select 1" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "Resetting public schema…"
"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; grant all on schema public to $PGUSER; grant all on schema public to public;"

echo "Creating app_users…"
"${PSQL[@]}" -f database/00_app_users.sql

echo "Creating Supabase role stubs…"
"${PSQL[@]}" -f database/01_supabase_roles.sql

echo "Applying migrations (auth.users → app_users)…"
for f in supabase/migrations/*.sql; do
  base=$(basename "$f")
  # Legacy Supabase demo admin UUID — no matching app_users row locally
  if [ "$base" = "20260820123906_f696e21e-295b-457a-92e5-977bbf52755d.sql" ]; then
    echo "  → skip $base (legacy supabase seed)"
    continue
  fi
  echo "  → $base"
  sed -e 's/auth\.users/public.app_users/g' \
      -e 's/references auth\.users/references public.app_users/g' \
      "$f" | "${PSQL[@]}"
done

echo "Applying local patches…"
"${PSQL[@]}" -f database/99_local_patches.sql

echo "Database ready."
