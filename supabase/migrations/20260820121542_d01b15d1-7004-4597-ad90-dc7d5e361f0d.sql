create or replace function public.assign_request(_request_id uuid, _vehicle_id uuid, _driver_id uuid, _actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.vehicle_requests%rowtype; win tstzrange; conflict_ref text; v public.vehicles%rowtype; d public.drivers%rowtype; t public.trips%rowtype; actor uuid;
begin
  actor := auth.uid();
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.is_dispatcher(actor) then raise exception 'Not authorised to assign trips'; end if;
  select * into r from public.vehicle_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status in ('completed','cancelled','rejected') then raise exception 'Request is % and cannot be assigned', r.status; end if;

  select * into v from public.vehicles where id = _vehicle_id for update;
  select * into d from public.drivers where id = _driver_id for update;
  if v.id is null or d.id is null then raise exception 'Vehicle or driver not found'; end if;
  if v.seat_capacity < r.passenger_count then
    raise exception 'Vehicle capacity (%) is below passenger count (%)', v.seat_capacity, r.passenger_count;
  end if;
  if v.operational_status in ('under_maintenance','out_of_service','unavailable','retired') then
    raise exception 'Vehicle is %', v.operational_status;
  end if;
  if d.current_status in ('leave','off_duty','unavailable','suspended') then
    raise exception 'Driver is %', d.current_status;
  end if;
  if d.license_expiry is not null and d.license_expiry <= r.journey_date then
    raise exception 'Driver licence expired';
  end if;
  if not (v.category = any(d.allowed_categories)) then
    raise exception 'Driver is not permitted to drive % vehicles', v.category;
  end if;

  win := public.request_window(r.pickup_at, coalesce(r.return_expected_end_at, r.expected_end_at));

  select o.reference into conflict_ref from public.vehicle_requests o
   where o.id <> r.id and o.assigned_vehicle_id = _vehicle_id and o.status in ('assigned','in_progress')
     and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win limit 1;
  if conflict_ref is not null then
    raise exception 'Vehicle already booked on % for an overlapping window', conflict_ref;
  end if;

  select o.reference into conflict_ref from public.vehicle_requests o
   where o.id <> r.id and o.assigned_driver_id = _driver_id and o.status in ('assigned','in_progress')
     and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win limit 1;
  if conflict_ref is not null then
    raise exception 'Driver already booked on % for an overlapping window', conflict_ref;
  end if;

  update public.vehicle_requests set assigned_vehicle_id = _vehicle_id, assigned_driver_id = _driver_id,
    assigned_at = now(), assigned_by = actor, status = 'assigned',
    approved_by = coalesce(approved_by, actor), approved_at = coalesce(approved_at, now()),
    version = version + 1
  where id = _request_id;

  update public.vehicles set operational_status = 'reserved' where id = _vehicle_id and operational_status = 'available';
  update public.drivers set current_status = 'reserved' where id = _driver_id and current_status = 'available';

  select * into t from public.trips where request_id = _request_id;
  if t.id is null then
    insert into public.trips (request_id, vehicle_id, driver_id, status)
    values (_request_id, _vehicle_id, _driver_id, 'driver_assigned') returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id)
    values (t.id, 'driver_assigned', 'Vehicle and driver assigned', actor);
  else
    update public.trips set vehicle_id = _vehicle_id, driver_id = _driver_id, status = 'driver_assigned' where id = t.id
    returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id)
    values (t.id, 'driver_assigned', 'Assignment changed', actor);
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_value, actor_id)
  values ('vehicle_request', _request_id, 'assign',
    jsonb_build_object('vehicle', v.registration_number, 'driver', d.full_name), actor);

  insert into public.notifications (user_id, category, title, body, link)
  select r.requester_id, 'assignment', 'Vehicle assigned to ' || r.reference,
    v.name || ' (' || v.registration_number || ') with driver ' || d.full_name, '/requests/' || r.id
  where r.requester_id is not null;

  insert into public.notifications (user_id, category, title, body, link)
  select d.user_id, 'assignment', 'New trip ' || t.reference,
    'Pickup at ' || to_char(r.pickup_at, 'DD Mon HH24:MI'), '/driver'
  where d.user_id is not null;

  return jsonb_build_object('trip_id', t.id, 'trip_reference', t.reference, 'request_reference', r.reference);
end; $$;

create or replace function public.advance_trip(_trip_id uuid, _action text, _actor uuid default null, _payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.trips%rowtype; r public.vehicle_requests%rowtype; nxt text; stops int; actor uuid;
begin
  actor := auth.uid();
  if actor is null then raise exception 'Authentication required'; end if;
  select * into t from public.trips where id = _trip_id for update;
  if not found then raise exception 'Trip not found'; end if;
  select * into r from public.vehicle_requests where id = t.request_id;

  if not (public.is_dispatcher(actor)
    or exists (select 1 from public.drivers d where d.id = t.driver_id and d.user_id = actor)) then
    raise exception 'Not authorised for this trip';
  end if;

  select count(*) into stops from public.request_route_points
    where request_id = r.id and leg = t.current_leg and point_type = 'stop';

  nxt := case _action
    when 'confirm' then case when t.status = 'driver_assigned' then 'driver_confirmed' end
    when 'head_to_pickup' then case when t.status in ('driver_assigned','driver_confirmed') then 'heading_to_pickup' end
    when 'arrive_pickup' then case when t.status = 'heading_to_pickup' then 'arrived_pickup' end
    when 'confirm_pickup' then case when t.status = 'arrived_pickup' then 'passenger_picked_up' end
    when 'depart' then case when t.status in ('passenger_picked_up','stop_reached') then 'in_transit' end
    when 'reach_stop' then case when t.status = 'in_transit' and t.current_stop_index < stops then 'stop_reached' end
    when 'reach_destination' then case when t.status in ('in_transit','passenger_picked_up') and t.current_stop_index >= stops then 'destination_reached' end
    when 'confirm_drop' then case when t.status = 'destination_reached' then
        case when r.is_round_trip and t.current_leg = 'outbound' then 'return_pending' else 'passenger_dropped' end end
    when 'start_return' then case when t.status = 'return_pending' then 'return_in_transit' end
    when 'complete' then case when t.status in ('passenger_dropped','return_in_transit','destination_reached') then 'completed' end
    when 'breakdown' then case when t.status not in ('completed','cancelled') then 'breakdown' end
    when 'cancel' then case when public.is_dispatcher(actor) then 'cancelled' end
    else null end;

  if nxt is null then
    raise exception 'Action "%" is not valid from status "%"', _action, t.status;
  end if;

  update public.trips set status = nxt,
    current_stop_index = case when nxt = 'stop_reached' then t.current_stop_index + 1
                              when nxt = 'return_in_transit' then 0 else t.current_stop_index end,
    current_leg = case when nxt = 'return_in_transit' then 'return' else t.current_leg end,
    started_at = coalesce(t.started_at, case when nxt = 'heading_to_pickup' then now() end),
    arrived_pickup_at = coalesce(t.arrived_pickup_at, case when nxt = 'arrived_pickup' then now() end),
    picked_up_at = coalesce(t.picked_up_at, case when nxt = 'passenger_picked_up' then now() end),
    completed_at = case when nxt = 'completed' then now() else t.completed_at end,
    odometer_start = coalesce((_payload->>'odometer_start')::int, t.odometer_start),
    odometer_end = coalesce((_payload->>'odometer_end')::int, t.odometer_end),
    driver_notes = coalesce(_payload->>'note', t.driver_notes)
  where id = _trip_id;

  insert into public.trip_status_history (trip_id, from_status, to_status, note, actor_id, latitude, longitude)
  values (_trip_id, t.status, nxt, _payload->>'note', actor,
    (_payload->>'latitude')::numeric, (_payload->>'longitude')::numeric);

  if nxt = 'completed' then
    update public.vehicle_requests set status = 'completed' where id = r.id;
    update public.vehicles set operational_status = 'available',
      odometer_km = greatest(odometer_km, coalesce((_payload->>'odometer_end')::int, odometer_km))
      where id = t.vehicle_id;
    update public.drivers set current_status = 'available' where id = t.driver_id;
    insert into public.notifications (user_id, category, title, body, link)
    select r.requester_id, 'trip', 'Trip completed: ' || r.reference, 'Your journey has been completed.', '/requests/' || r.id
    where r.requester_id is not null;
  elsif nxt = 'cancelled' then
    update public.vehicle_requests set status = 'cancelled' where id = r.id;
    update public.vehicles set operational_status = 'available' where id = t.vehicle_id;
    update public.drivers set current_status = 'available' where id = t.driver_id;
  elsif nxt = 'breakdown' then
    update public.vehicles set operational_status = 'unavailable' where id = t.vehicle_id;
    insert into public.notifications (audience_role, category, title, body, link)
    values ('transport_admin', 'emergency', 'Breakdown reported on ' || r.reference,
      coalesce(_payload->>'note','Driver reported a vehicle breakdown'), '/requests/' || r.id);
  elsif nxt = 'heading_to_pickup' then
    update public.vehicle_requests set status = 'in_progress' where id = r.id;
    update public.vehicles set operational_status = 'on_trip' where id = t.vehicle_id;
    update public.drivers set current_status = 'driving' where id = t.driver_id;
    insert into public.notifications (user_id, category, title, body, link)
    select r.requester_id, 'trip', 'Driver heading to pickup', 'Your driver is on the way.', '/requests/' || r.id
    where r.requester_id is not null;
  elsif nxt in ('arrived_pickup','passenger_picked_up') then
    insert into public.notifications (user_id, category, title, body, link)
    select r.requester_id, 'trip',
      case when nxt = 'arrived_pickup' then 'Driver has arrived' else 'Passenger picked up' end,
      'Trip ' || t.reference, '/requests/' || r.id
    where r.requester_id is not null;
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, old_value, new_value, actor_id)
  values ('trip', _trip_id, _action, jsonb_build_object('status', t.status), jsonb_build_object('status', nxt), actor);

  return jsonb_build_object('status', nxt);
end; $$;

revoke execute on function public.assign_request(uuid,uuid,uuid,uuid) from public, anon;
revoke execute on function public.advance_trip(uuid,text,uuid,jsonb) from public, anon;
grant execute on function public.assign_request(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.advance_trip(uuid,text,uuid,jsonb) to authenticated;