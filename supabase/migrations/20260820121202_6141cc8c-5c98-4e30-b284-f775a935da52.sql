create policy "read departments" on public.departments for select to authenticated using (true);
create policy "read locations" on public.locations for select to authenticated using (true);
create policy "manage locations" on public.locations for all to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));

create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_dispatcher(auth.uid()));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_dispatcher(auth.uid()));

create policy "read vehicles" on public.vehicles for select to authenticated using (true);
create policy "manage vehicles" on public.vehicles for all to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));

create policy "read drivers" on public.drivers for select to authenticated using (true);
create policy "manage drivers" on public.drivers for all to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));
create policy "driver updates self" on public.drivers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read requests" on public.vehicle_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_dispatcher(auth.uid())
    or exists (select 1 from public.drivers d where d.id = assigned_driver_id and d.user_id = auth.uid()));
create policy "create own request" on public.vehicle_requests for insert to authenticated
  with check (requester_id = auth.uid());
create policy "update own draft request" on public.vehicle_requests for update to authenticated
  using (requester_id = auth.uid() and status in ('draft','submitted'));
create policy "dispatcher manages requests" on public.vehicle_requests for all to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));

create policy "read route points" on public.request_route_points for select to authenticated using (true);
create policy "write route points" on public.request_route_points for all to authenticated
  using (exists (select 1 from public.vehicle_requests r where r.id = request_id
      and (r.requester_id = auth.uid() or public.is_dispatcher(auth.uid()))))
  with check (exists (select 1 from public.vehicle_requests r where r.id = request_id
      and (r.requester_id = auth.uid() or public.is_dispatcher(auth.uid()))));

create policy "read passengers" on public.request_passengers for select to authenticated using (true);
create policy "write passengers" on public.request_passengers for all to authenticated
  using (exists (select 1 from public.vehicle_requests r where r.id = request_id
      and (r.requester_id = auth.uid() or public.is_dispatcher(auth.uid()))))
  with check (exists (select 1 from public.vehicle_requests r where r.id = request_id
      and (r.requester_id = auth.uid() or public.is_dispatcher(auth.uid()))));

create policy "read trips" on public.trips for select to authenticated using (true);
create policy "dispatcher writes trips" on public.trips for all to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));
create policy "driver updates own trip" on public.trips for update to authenticated
  using (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid()));

create policy "read trip history" on public.trip_status_history for select to authenticated using (true);
create policy "insert trip history" on public.trip_status_history for insert to authenticated with check (true);

create policy "read unavailability" on public.vehicle_unavailability_requests for select to authenticated using (true);
create policy "create unavailability" on public.vehicle_unavailability_requests for insert to authenticated
  with check (created_by = auth.uid());
create policy "dispatcher reviews unavailability" on public.vehicle_unavailability_requests for update to authenticated
  using (public.is_dispatcher(auth.uid())) with check (public.is_dispatcher(auth.uid()));

create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid() or (audience_role is not null and exists (
    select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = audience_role)));
create policy "insert notifications" on public.notifications for insert to authenticated with check (true);
create policy "update own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read audit" on public.audit_logs for select to authenticated using (public.is_dispatcher(auth.uid()));
create policy "insert audit" on public.audit_logs for insert to authenticated with check (true);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare _role public.app_role;
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;

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
    where id = (select id from public.drivers where user_id is null order by driver_code limit 1);
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.request_window(_pickup timestamptz, _end timestamptz, _buffer_min int default 30)
returns tstzrange language sql immutable as $$
  select tstzrange(_pickup - make_interval(mins => _buffer_min), _end + make_interval(mins => _buffer_min), '[)')
$$;

create or replace function public.get_recommendations(_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.vehicle_requests%rowtype; win tstzrange; res jsonb;
begin
  select * into r from public.vehicle_requests where id = _request_id;
  if not found then return '[]'::jsonb; end if;
  win := public.request_window(r.pickup_at, coalesce(r.return_expected_end_at, r.expected_end_at));

  with pickup as (
    select latitude lat, longitude lng from public.request_route_points
    where request_id = r.id and leg = 'outbound' and point_type = 'pickup' limit 1
  ),
  veh as (
    select v.*,
      case when p.lat is null or v.current_latitude is null then null
        else round((point(v.current_longitude, v.current_latitude) <@> point(p.lng, p.lat))::numeric * 1.609, 1) end as dist_km,
      exists (select 1 from public.vehicle_requests o
        where o.assigned_vehicle_id = v.id and o.id <> r.id
          and o.status in ('assigned','in_progress')
          and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win) as busy,
      (select min(o.pickup_at) from public.vehicle_requests o
        where o.assigned_vehicle_id = v.id and o.id <> r.id and o.status in ('assigned','in_progress')
          and o.pickup_at > r.expected_end_at) as next_assignment_at
    from public.vehicles v left join pickup p on true
  ),
  drv as (
    select d.*,
      exists (select 1 from public.vehicle_requests o
        where o.assigned_driver_id = d.id and o.id <> r.id
          and o.status in ('assigned','in_progress')
          and public.request_window(o.pickup_at, coalesce(o.return_expected_end_at, o.expected_end_at)) && win) as busy,
      (select count(*) from public.vehicle_requests o
        where o.assigned_driver_id = d.id and o.journey_date = r.journey_date) as trips_today
    from public.drivers d
  ),
  combos as (
    select v.id vid, d.id did, v.name vname, v.registration_number vreg, v.category vcat, v.seat_capacity vseat,
      v.dist_km, v.operational_status vstatus, v.has_ac, v.is_vip, v.next_assignment_at,
      v.insurance_expiry, v.fitness_expiry, v.last_service_date,
      d.full_name dname, d.phone dphone, d.current_status dstatus, d.license_expiry, d.rating, d.trips_today, d.experience_years,
      (case when v.operational_status in ('available','reserved') and not v.busy then 30
            when v.operational_status = 'on_trip' and not v.busy then 22 else 0 end)
      + (case when v.seat_capacity < r.passenger_count then 0
              when v.seat_capacity - r.passenger_count <= 2 then 20
              when v.seat_capacity - r.passenger_count <= 5 then 15
              else 9 end)
      + (case when v.dist_km is null then 8
              when v.dist_km <= 2 then 15 when v.dist_km <= 5 then 12
              when v.dist_km <= 12 then 8 else 4 end)
      + (case when d.busy or d.current_status in ('leave','off_duty','unavailable','suspended') then 0
              when v.category = any(d.allowed_categories) then 15 else 4 end)
      + (case when v.next_assignment_at is null then 10
              when v.next_assignment_at - r.expected_end_at >= interval '2 hours' then 9
              when v.next_assignment_at - r.expected_end_at >= interval '45 minutes' then 6 else 2 end)
      + (case when r.requested_category is null or r.requested_category = v.category then 5 else 1 end)
      + (case when d.trips_today = 0 then 5 when d.trips_today = 1 then 4 when d.trips_today <= 3 then 2 else 0 end)
      as score
    from veh v cross join drv d
    where v.operational_status not in ('under_maintenance','out_of_service','unavailable','retired')
      and v.seat_capacity >= r.passenger_count
      and not v.busy and not d.busy
      and d.current_status not in ('leave','off_duty','unavailable','suspended')
      and (d.license_expiry is null or d.license_expiry > r.journey_date)
      and v.category = any(d.allowed_categories)
      and (not r.requires_ac or v.has_ac)
      and (r.priority <> 'vip' or v.is_vip or v.category in ('sedan','suv'))
  ),
  ranked as (
    select *, row_number() over (partition by vid order by score desc, rating desc) rn from combos
  )
  select coalesce(jsonb_agg(x order by x.score desc), '[]'::jsonb) into res from (
    select score, vid, did, vname, vreg, vcat, vseat, dist_km, dname, dphone, dstatus, rating, trips_today,
      next_assignment_at, license_expiry, last_service_date, experience_years, vstatus, has_ac, is_vip
    from ranked where rn = 1 order by score desc limit 8
  ) x;

  return res;
end; $$;

create or replace function public.assign_request(_request_id uuid, _vehicle_id uuid, _driver_id uuid, _actor uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.vehicle_requests%rowtype; win tstzrange; conflict_ref text; v public.vehicles%rowtype; d public.drivers%rowtype; t public.trips%rowtype;
begin
  if not public.is_dispatcher(_actor) then raise exception 'Not authorised to assign trips'; end if;
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
    assigned_at = now(), assigned_by = _actor, status = 'assigned',
    approved_by = coalesce(approved_by, _actor), approved_at = coalesce(approved_at, now()),
    version = version + 1
  where id = _request_id;

  update public.vehicles set operational_status = 'reserved' where id = _vehicle_id and operational_status = 'available';
  update public.drivers set current_status = 'reserved' where id = _driver_id and current_status = 'available';

  select * into t from public.trips where request_id = _request_id;
  if t.id is null then
    insert into public.trips (request_id, vehicle_id, driver_id, status)
    values (_request_id, _vehicle_id, _driver_id, 'driver_assigned') returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id)
    values (t.id, 'driver_assigned', 'Vehicle and driver assigned', _actor);
  else
    update public.trips set vehicle_id = _vehicle_id, driver_id = _driver_id, status = 'driver_assigned' where id = t.id
    returning * into t;
    insert into public.trip_status_history (trip_id, to_status, note, actor_id)
    values (t.id, 'driver_assigned', 'Assignment changed', _actor);
  end if;

  insert into public.audit_logs (entity_type, entity_id, action, new_value, actor_id)
  values ('vehicle_request', _request_id, 'assign',
    jsonb_build_object('vehicle', v.registration_number, 'driver', d.full_name), _actor);

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

create or replace function public.advance_trip(_trip_id uuid, _action text, _actor uuid, _payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.trips%rowtype; r public.vehicle_requests%rowtype; nxt text; stops int;
begin
  select * into t from public.trips where id = _trip_id for update;
  if not found then raise exception 'Trip not found'; end if;
  select * into r from public.vehicle_requests where id = t.request_id;

  if not (public.is_dispatcher(_actor)
    or exists (select 1 from public.drivers d where d.id = t.driver_id and d.user_id = _actor)) then
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
    when 'cancel' then case when public.is_dispatcher(_actor) then 'cancelled' end
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
  values (_trip_id, t.status, nxt, _payload->>'note', _actor,
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
  values ('trip', _trip_id, _action, jsonb_build_object('status', t.status), jsonb_build_object('status', nxt), _actor);

  return jsonb_build_object('status', nxt);
end; $$;

revoke execute on function public.assign_request(uuid,uuid,uuid,uuid) from anon;
revoke execute on function public.advance_trip(uuid,text,uuid,jsonb) from anon;
revoke execute on function public.get_recommendations(uuid) from anon;
revoke execute on function public.next_ref(text,text) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.is_dispatcher(uuid) from anon;