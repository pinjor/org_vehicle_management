-- Stick each vehicle to one primary driver (1:1 for assignment).
alter table public.vehicles
  add column if not exists primary_driver_id uuid references public.drivers(id) on delete set null;

create unique index if not exists idx_vehicles_primary_driver_unique
  on public.vehicles (primary_driver_id)
  where primary_driver_id is not null;

comment on column public.vehicles.primary_driver_id is
  'Driver permanently paired with this vehicle; assign_request only allows this pair.';

-- Recommendations: only linked vehicle↔ driver pairs
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
    where v.primary_driver_id is not null
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
    from veh v
    join drv d on d.id = v.primary_driver_id
    where v.operational_status not in ('under_maintenance','out_of_service','unavailable','retired')
      and v.seat_capacity >= r.passenger_count
      and not v.busy and not d.busy
      and d.current_status not in ('leave','off_duty','unavailable','suspended')
      and (d.license_expiry is null or d.license_expiry > r.journey_date)
      and (not r.requires_ac or v.has_ac)
      and (r.priority <> 'vip' or v.is_vip or v.category in ('sedan','suv'))
  )
  select coalesce(jsonb_agg(x order by x.score desc), '[]'::jsonb) into res from (
    select score, vid, did, vname, vreg, vcat, vseat, dist_km, dname, dphone, dstatus, rating, trips_today,
      next_assignment_at, license_expiry, last_service_date, experience_years, vstatus, has_ac, is_vip
    from combos order by score desc, rating desc nulls last limit 8
  ) x;

  return res;
end; $$;
