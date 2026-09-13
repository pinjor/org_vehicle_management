-- Ensure demo quick-login accounts exist (idempotent).
-- Passwords (bcryptjs): admin123 / emp123 / driver123
-- Phones match DEMO_USERS on auth page + seed_starter roster.

\set ON_ERROR_STOP on

begin;

-- Admin: Transport Admin
with u as (
  insert into public.app_users (phone, password_hash)
  values ('+8801711000001', '$2b$10$VmjvE5oCOlh8M7SlF6xTQutMUrAu/H0GSf8Lpk0in0EUJZy0G2.E.')
  on conflict (phone) do update set password_hash = excluded.password_hash
  returning id, phone
)
insert into public.profiles (id, full_name, phone)
select u.id, 'Transport Admin', u.phone from u
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

insert into public.user_roles (user_id, role)
select p.id, r.role
from public.profiles p
cross join (values
  ('employee'::public.app_role),
  ('transport_admin'::public.app_role),
  ('system_admin'::public.app_role)
) as r(role)
where p.phone = '+8801711000001'
on conflict do nothing;

update public.user_roster
set user_id = (select id from public.profiles where phone = '+8801711000001'),
    role = 'admin_hr',
    is_active = true,
    updated_at = now()
where phone = '+8801711000001';

-- Employee: Nusrat Jahan
with u as (
  insert into public.app_users (phone, password_hash)
  values ('+8801712000003', '$2b$10$tNOCkF/T8zIf.CWWMdxkD.Sa7McI70cItiVAOeF.ZOo34k9jhHdK2')
  on conflict (phone) do update set password_hash = excluded.password_hash
  returning id, phone
)
insert into public.profiles (id, full_name, phone)
select u.id, 'Nusrat Jahan', u.phone from u
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

insert into public.user_roles (user_id, role)
select p.id, 'employee'::public.app_role
from public.profiles p
where p.phone = '+8801712000003'
on conflict do nothing;

update public.user_roster
set user_id = (select id from public.profiles where phone = '+8801712000003'),
    role = 'employee',
    is_active = true,
    updated_at = now()
where phone = '+8801712000003';

-- Driver: Karim Hassan (roster + drivers.user_id)
with u as (
  insert into public.app_users (phone, password_hash)
  values ('+8801712000002', '$2b$10$CxnlX2wRSyPmVwMaYut.hOQ5JvIzYVwEaje0N3t3zS20A1FC2hj7a')
  on conflict (phone) do update set password_hash = excluded.password_hash
  returning id, phone
)
insert into public.profiles (id, full_name, phone)
select u.id, 'Karim Hassan', u.phone from u
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

insert into public.user_roles (user_id, role)
select p.id, r.role
from public.profiles p
cross join (values
  ('employee'::public.app_role),
  ('driver'::public.app_role)
) as r(role)
where p.phone = '+8801712000002'
on conflict do nothing;

update public.user_roster
set user_id = (select id from public.profiles where phone = '+8801712000002'),
    role = 'driver',
    full_name = 'Karim Hassan',
    is_active = true,
    updated_at = now()
where phone = '+8801712000002';

update public.drivers d
set user_id = p.id,
    full_name = coalesce(nullif(d.full_name, ''), 'Karim Hassan'),
    updated_at = now()
from public.profiles p
where p.phone = '+8801712000002'
  and public.normalize_bd_phone(d.phone) = p.phone;

-- If no driver row matched phone, ensure one exists for demo
insert into public.drivers (driver_code, full_name, phone, license_number, current_status, user_id)
select
  'DRV-DEMO-002',
  'Karim Hassan',
  '+8801712000002',
  'DL-DEMO-0002',
  'available',
  p.id
from public.profiles p
where p.phone = '+8801712000002'
  and not exists (
    select 1 from public.drivers d
    where public.normalize_bd_phone(d.phone) = '+8801712000002'
  );

commit;
