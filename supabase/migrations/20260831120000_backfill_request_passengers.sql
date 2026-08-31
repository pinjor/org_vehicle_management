-- Ensure every request has at least the requester as a named passenger
-- (booking used to send passengers: [] so driver/admin mobile had no contact).

insert into public.request_passengers (request_id, full_name, phone, passenger_type, is_primary)
select vr.id, vr.requester_name, nullif(trim(vr.requester_phone), ''), 'employee', true
from public.vehicle_requests vr
where vr.requester_name is not null
  and trim(vr.requester_name) <> ''
  and not exists (
    select 1 from public.request_passengers rp where rp.request_id = vr.id
  );
