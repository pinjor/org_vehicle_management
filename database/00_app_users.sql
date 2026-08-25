-- Local auth users (replaces Supabase auth.users)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_users_phone on public.app_users(phone);
