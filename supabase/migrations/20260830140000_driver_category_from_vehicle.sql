-- Driver category follows primary vehicle; assign no longer checks allowed_categories.

update public.drivers d
set allowed_categories = array[v.category]
from public.vehicles v
where v.primary_driver_id = d.id;

create or replace function public.assign_request(_request_id uuid, _vehicle_id uuid, _driver_id uuid, _actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.vehicle_requests%rowtype; win tstzrange; conflict_ref text; v public.vehicles%rowtype; d public.drivers%rowtype; t public.trips%rowtype; actor uuid;
begin
  actor := _actor;
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.is_dispatcher(actor) then raise exception 'Not authorised to assign trips'; end if;
  select * into r from public.vehicle_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status in ('completed','cancelled','rejected') then raise exception 'Request is % and cannot be assigned', r.status; end if;

  select * into v from public.vehicles where id = _vehicle_id for update;
  select * into d from public.drivers where id = _driver_id for update;
  if v.id is null or d.id is null then raise exception 'Vehicle or driver not found'; end if;
  if v.seat_capacity < r.passenger_count then raise exception 'Vehicle capacity (%) is below passenger count (%)', v.seat_capacity, r.passenger_count; end if;
  if v.operational_status in ('under_maintenance','out_of_service','unavailable','retired') then raise exception 'Vehicle is %', v.operational_status; end if;
  if d.current_status in ('leave','off_duty','unavailable','suspended') then raise exception 'Driver is %', d.current_status; end if;
  if d.license_expiry is not null and d.license_expiry <= r.journey_date then raise exception 'Driver licence expired'; end if;

  win := public.request_window(r.pickup_at, coalesce(r.return_expected_end_at, r.expected_end_at));

  select o.reference into conflict_ref from public.vehicle_requests o
   where o.id <> r.id and o.assigned_vehicle_id = _vehicle_id and o.status in ('assigned','in_progress')
     and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win limit 1;
  if conflict_ref is not null then raise exception 'Vehicle already booked on % for an overlapping window', conflict_ref; end if;

  select o.reference into conflict_ref from public.vehicle_requests o
   where o.id <> r.id and o.assigned_driver_id = _driver_id and o.status in ('assigned','in_progress')
     and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win limit 1;
  if conflict_ref is not null then raise exception 'Driver already booked on % for an overlapping window', conflict_ref; end if;

  if r.assigned_vehicle_id is not null and r.assigned_vehicle_id is distinct from _vehicle_id then
    update public.vehicles set operational_status = 'available'
     where id = r.assigned_vehicle_id and operational_status = 'reserved';
  end if;
  if r.assigned_driver_id is not null and r.assigned_driver_id is distinct from _driver_id then
    update public.drivers set current_status = 'available'
     where id = r.assigned_driver_id and current_status = 'reserved';
  end if;

  update public.vehicle_requests set assigned_vehicle_id = _vehicle_id, assigned_driver_id = _driver_id,
    assigned_at = now(), assigned_by = actor, status = 'assigned',
    approved_by = coalesce(approved_by, actor), approved_at = coalesce(approved_at, now()), version = version + 1
  where id = _request_id;

  update public.vehicles set operational_status = 'reserved' where id = _vehicle_id and operational_status = 'available';
  update public.drivers set current_status = 'reserved' where id = _driver_id and current_status = 'available';

  select * into t from public.trips where request_id = _request_id;
  if t.id is null then
    insert into public.trips (request_id, vehicle_id, driver_id, status)
    values (_request_id, _vehicle_id, _driver_id, 'driver_assigned') returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id) values (t.id, 'driver_assigned', 'Vehicle and driver assigned', actor);
  else
    update public.trips set vehicle_id = _vehicle_id, driver_id = _driver_id, status = 'driver_assigned' where id = t.id returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id) values (t.id, 'driver_assigned', 'Assignment changed', actor);
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_value, actor_id)
  values ('vehicle_request', _request_id, 'assign', jsonb_build_object('vehicle', v.registration_number, 'driver', d.full_name), actor);

  insert into public.notifications (user_id, category, title, body, link)
  select r.requester_id, 'assignment', 'Vehicle assigned to ' || r.reference, v.name || ' (' || v.registration_number || ') with driver ' || d.full_name, '/requests/' || r.id
  where r.requester_id is not null;

  insert into public.notifications (user_id, category, title, body, link)
  select d.user_id, 'assignment', 'New trip ' || t.reference, 'Pickup at ' || to_char(r.pickup_at, 'DD Mon HH24:MI'), '/my-trips'
  where d.user_id is not null;

  return jsonb_build_object('trip_id', t.id, 'trip_reference', t.reference);
end;
$$;
