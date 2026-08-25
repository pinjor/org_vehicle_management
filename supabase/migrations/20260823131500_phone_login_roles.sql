-- Phone-only login: link drivers by phone, demo admin role for seeded admin number
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _role public.app_role;
  _phone text := coalesce(new.phone, new.raw_user_meta_data->>'phone', '');
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    _phone
  )
  on conflict (id) do update set
    phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end;

  begin
    _role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'employee');
  exception when others then _role := 'employee';
  end;

  insert into public.user_roles (user_id, role) values (new.id, _role) on conflict do nothing;
  if _role <> 'employee' then
    insert into public.user_roles (user_id, role) values (new.id, 'employee') on conflict do nothing;
  end if;

  -- Auto driver role when phone matches roster (e.g. demo driver 01711234501)
  if exists (select 1 from public.drivers d where d.phone = _phone) then
    insert into public.user_roles (user_id, role) values (new.id, 'driver') on conflict do nothing;
    update public.drivers set user_id = new.id where phone = _phone and user_id is null;
  elsif _role = 'driver' then
    update public.drivers set user_id = new.id
    where id = (select id from public.drivers where user_id is null order by driver_code limit 1);
  end if;

  -- Demo admin phone (+880 1711 000001)
  if _phone = '+8801711000001' then
    insert into public.user_roles (user_id, role) values
      (new.id, 'transport_admin'),
      (new.id, 'system_admin')
    on conflict do nothing;
  end if;

  return new;
end; $$;
