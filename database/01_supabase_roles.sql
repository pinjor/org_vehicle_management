-- Stub Supabase roles so original migrations apply on plain PostgreSQL
do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

grant authenticated to fleetops;
grant service_role to fleetops;
grant anon to fleetops;

-- Stub auth.uid() so Supabase RLS policies in migrations can be created (RLS disabled in local patches)
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;
