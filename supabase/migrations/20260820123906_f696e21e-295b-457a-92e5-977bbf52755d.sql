insert into public.user_roles (user_id, role) values
 ('1fd5eafe-a179-4fd6-8e9c-8221f3a1c974','transport_admin'),
 ('1fd5eafe-a179-4fd6-8e9c-8221f3a1c974','system_admin')
on conflict do nothing;