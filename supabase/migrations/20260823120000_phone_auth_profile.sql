-- Store phone from Supabase Auth on signup / phone OTP login
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare _role public.app_role;
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end;

  begin
    _role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'employee');
  exception when others then _role := 'employee';
  end;

  insert into public.user_roles (user_id, role) values (new.id, _role) on conflict do nothing;
  if _role <> 'employee' then
    insert into public.user_roles (user_id, role) values (new.id, 'employee') on conflict do nothing;
  end if;

  if _role = 'driver' then
    update public.drivers set user_id = new.id
    where id = (
      select d.id from public.drivers d
      where d.user_id is null
        and d.phone = coalesce(new.phone, new.raw_user_meta_data->>'phone', '')
      limit 1
    );
    if not found then
      update public.drivers set user_id = new.id
      where id = (select id from public.drivers where user_id is null order by driver_code limit 1);
    end if;
  end if;
  return new;
end; $$;
