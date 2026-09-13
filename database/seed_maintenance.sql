-- Demo maintenance desk data (idempotent). Safe to re-run after seed_starter.
\set ON_ERROR_STOP on

begin;

-- Put Hilux in the shop (demo).
update public.vehicles
set operational_status = 'under_maintenance',
    updated_at = now()
where fleet_number = 'FL-020';

-- Pending report (awaiting admin) — Prado
insert into public.vehicle_unavailability_requests (
  vehicle_id, driver_id, reason, description, severity, status, created_by
)
select
  v.id,
  d.id,
  'mechanical',
  'Engine warning light on; rough idle after airport run. Needs inspection before next VIP trip.',
  'high',
  'pending',
  p.id
from public.vehicles v
cross join public.drivers d
left join public.profiles p on p.phone = '+8801711000001'
where v.fleet_number = 'FL-006'
  and d.driver_code = 'DRV-006'
  and not exists (
    select 1 from public.vehicle_unavailability_requests u
    where u.vehicle_id = v.id and u.status = 'pending'
  );

-- In shop (already reviewed) — Hilux
insert into public.vehicle_unavailability_requests (
  vehicle_id, driver_id, reason, description, severity, status, admin_note, reviewed_by, reviewed_at, created_by
)
select
  v.id,
  d.id,
  'tire',
  'Rear right tyre puncture on Tejgaon approach. Spare fitted; needs new tyre + alignment.',
  'medium',
  'sent_to_maintenance',
  'Sent to workshop — replace tyre and check alignment.',
  p.id,
  now() - interval '1 day',
  p.id
from public.vehicles v
cross join public.drivers d
left join public.profiles p on p.phone = '+8801711000001'
where v.fleet_number = 'FL-020'
  and d.driver_code = 'DRV-001'
  and not exists (
    select 1 from public.vehicle_unavailability_requests u
    where u.vehicle_id = v.id and u.status = 'sent_to_maintenance'
  );

-- Resolved history sample — Hiace
insert into public.vehicle_unavailability_requests (
  vehicle_id, driver_id, reason, description, severity, status, admin_note, reviewed_by, reviewed_at, created_by
)
select
  v.id,
  d.id,
  'battery',
  'Won''t crank after overnight park. Jump-start worked once.',
  'medium',
  'resolved',
  'Battery replaced. Returned to service.',
  p.id,
  now() - interval '5 days',
  p.id
from public.vehicles v
cross join public.drivers d
left join public.profiles p on p.phone = '+8801711000001'
where v.fleet_number = 'FL-010'
  and d.driver_code = 'DRV-003'
  and not exists (
    select 1 from public.vehicle_unavailability_requests u
    where u.vehicle_id = v.id
      and u.reason = 'battery'
      and u.status = 'resolved'
  );

commit;
