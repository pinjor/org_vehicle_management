-- User roster: admin pre-registers employees, drivers, and admin/HR by phone before they can sign up.

create type public.roster_role as enum ('admin_hr', 'driver', 'employee');

create table public.user_roster (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  role public.roster_role not null default 'employee',
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint user_roster_phone_unique unique (phone)
);

create index idx_user_roster_phone on public.user_roster(phone);
create index idx_user_roster_role on public.user_roster(role);
create index idx_user_roster_active on public.user_roster(is_active) where is_active = true;

grant select, insert, update, delete on public.user_roster to authenticated;
grant all on public.user_roster to service_role;
alter table public.user_roster enable row level security;

create policy "admins manage roster" on public.user_roster for all to authenticated
  using (public.is_dispatcher(auth.uid()))
  with check (public.is_dispatcher(auth.uid()));

create trigger trg_user_roster_updated before update on public.user_roster
for each row execute function public.set_updated_at();

-- Normalize BD mobile to +8801XXXXXXXXX
create or replace function public.normalize_bd_phone(_input text)
returns text language plpgsql immutable set search_path = public as $$
declare
  digits text;
  national text;
begin
  if _input is null or trim(_input) = '' then return null; end if;
  digits := regexp_replace(_input, '\D', '', 'g');
  national := digits;
  if national like '880%' then national := substring(national from 4); end if;
  if national like '0%' then national := substring(national from 2); end if;
  if length(national) <> 10 or national !~ '^1[3-9]' then return null; end if;
  return '+880' || national;
end;
$$;

-- Sign-up step 1: check phone is on admin roster (callable before auth)
create or replace function public.lookup_roster_phone(_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  normalized text := public.normalize_bd_phone(_phone);
  r public.user_roster%rowtype;
begin
  if normalized is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_phone');
  end if;

  select * into r from public.user_roster where phone = normalized and is_active = true;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_on_roster');
  end if;

  if r.user_id is not null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'already_registered',
      'full_name', r.full_name
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'full_name', r.full_name,
    'role', r.role
  );
end;
$$;

grant execute on function public.normalize_bd_phone(text) to authenticated;
grant execute on function public.lookup_roster_phone(text) to anon, authenticated;

-- Only roster-listed phones may create accounts; roles come from roster
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _phone text := public.normalize_bd_phone(coalesce(new.phone, new.raw_user_meta_data->>'phone', ''));
  roster public.user_roster%rowtype;
  _name text;
begin
  if _phone is null then
    raise exception 'A valid Bangladesh mobile number is required';
  end if;

  select * into roster from public.user_roster where phone = _phone and is_active = true;
  if not found then
    raise exception 'This phone number is not registered. Contact admin or HR to be added to the system.';
  end if;

  if roster.user_id is not null then
    raise exception 'An account already exists for this phone number. Please sign in.';
  end if;

  _name := coalesce(nullif(trim(roster.full_name), ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User');

  insert into public.profiles (id, full_name, email, phone)
  values (new.id, _name, new.email, _phone)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone;

  insert into public.user_roles (user_id, role) values (new.id, 'employee') on conflict do nothing;

  if roster.role = 'admin_hr' then
    insert into public.user_roles (user_id, role) values
      (new.id, 'transport_admin'),
      (new.id, 'system_admin')
    on conflict do nothing;
  elsif roster.role = 'driver' then
    insert into public.user_roles (user_id, role) values (new.id, 'driver') on conflict do nothing;
    update public.drivers set user_id = new.id where phone = _phone and user_id is null;
  end if;

  update public.user_roster set user_id = new.id, updated_at = now() where id = roster.id;

  return new;
end;
$$;

-- Seed roster: admin + drivers from fleet seed + sample employees
insert into public.user_roster (full_name, phone, role)
select d.full_name, public.normalize_bd_phone(d.phone), 'driver'::public.roster_role
from public.drivers d
where public.normalize_bd_phone(d.phone) is not null
on conflict (phone) do nothing;

insert into public.user_roster (full_name, phone, role) values
  ('Transport Admin', '+8801711000001', 'admin_hr'),
  ('Sadia Rahman', '+8801712000001', 'employee'),
  ('Karim Hassan', '+8801712000002', 'employee'),
  ('Nusrat Jahan', '+8801712000003', 'employee'),
  ('HR Manager', '+8801712000004', 'admin_hr')
on conflict (phone) do nothing;
