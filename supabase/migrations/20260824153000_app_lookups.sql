-- Dynamic lookup tables for labels, tones, and option lists (settings page).

create table if not exists public.app_lookup_groups (
  key text primary key,
  label text not null,
  description text,
  sort_order int not null default 0
);

create table if not exists public.app_lookup_values (
  id uuid primary key default gen_random_uuid(),
  group_key text not null references public.app_lookup_groups(key) on delete cascade,
  value_key text not null,
  label text not null,
  tone text not null default 'neutral'
    check (tone in ('success', 'warning', 'danger', 'info', 'neutral', 'primary')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (group_key, value_key)
);

create index if not exists idx_app_lookup_values_group on public.app_lookup_values(group_key, sort_order);

grant select on public.app_lookup_groups, public.app_lookup_values to authenticated;
grant all on public.app_lookup_groups, public.app_lookup_values to service_role;

insert into public.app_lookup_groups (key, label, description, sort_order) values
  ('request_status', 'Request status', 'Vehicle request workflow states', 10),
  ('trip_status', 'Trip status', 'Live trip progress states', 20),
  ('vehicle_status', 'Vehicle status', 'Fleet operational status', 30),
  ('driver_status', 'Driver status', 'Driver duty status', 40),
  ('priority', 'Priority', 'Request urgency levels', 50),
  ('trip_type', 'Trip type', 'Journey type options', 60),
  ('shift', 'Driver shift', 'Driver shift patterns', 70),
  ('severity', 'Severity', 'Maintenance report severity', 80),
  ('roster_role', 'Roster role', 'User roster roles', 90),
  ('app_role', 'App role', 'Signed-in user roles', 100),
  ('unavailability_status', 'Downtime status', 'Vehicle unavailability review states', 110),
  ('vehicle_category', 'Vehicle category', 'Fleet vehicle types', 120),
  ('fuel_type', 'Fuel type', 'Vehicle fuel options', 130),
  ('ownership', 'Ownership', 'Vehicle ownership type', 140),
  ('location_type', 'Location type', 'Saved location categories', 150),
  ('passenger_type', 'Passenger type', 'Passenger classification', 160),
  ('unavailability_reason', 'Downtime reason', 'Why a vehicle is unavailable', 170),
  ('route_point_type', 'Route point type', 'Pickup, stop, destination', 180),
  ('notification_category', 'Notification type', 'In-app notification categories', 190)
on conflict (key) do nothing;

-- request_status
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('request_status', 'draft', 'Draft', 'neutral', 1),
  ('request_status', 'submitted', 'Awaiting review', 'warning', 2),
  ('request_status', 'under_review', 'Under review', 'warning', 3),
  ('request_status', 'approved', 'Approved', 'info', 4),
  ('request_status', 'rejected', 'Rejected', 'danger', 5),
  ('request_status', 'assigned', 'Assigned', 'primary', 6),
  ('request_status', 'in_progress', 'In progress', 'success', 7),
  ('request_status', 'completed', 'Completed', 'neutral', 8),
  ('request_status', 'cancelled', 'Cancelled', 'danger', 9)
on conflict (group_key, value_key) do nothing;

-- trip_status
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('trip_status', 'driver_assigned', 'Driver assigned', 'primary', 1),
  ('trip_status', 'driver_confirmed', 'Driver confirmed', 'primary', 2),
  ('trip_status', 'heading_to_pickup', 'Heading to pickup', 'info', 3),
  ('trip_status', 'arrived_pickup', 'Arrived at pickup', 'info', 4),
  ('trip_status', 'passenger_picked_up', 'Passenger on board', 'success', 5),
  ('trip_status', 'in_transit', 'In transit', 'success', 6),
  ('trip_status', 'stop_reached', 'Stop reached', 'info', 7),
  ('trip_status', 'destination_reached', 'At destination', 'info', 8),
  ('trip_status', 'passenger_dropped', 'Passenger dropped', 'success', 9),
  ('trip_status', 'return_pending', 'Return pending', 'warning', 10),
  ('trip_status', 'return_in_transit', 'Return journey', 'success', 11),
  ('trip_status', 'completed', 'Completed', 'neutral', 12),
  ('trip_status', 'cancelled', 'Cancelled', 'danger', 13),
  ('trip_status', 'no_show', 'No show', 'danger', 14),
  ('trip_status', 'breakdown', 'Breakdown', 'danger', 15),
  ('trip_status', 'emergency_stop', 'Emergency stop', 'danger', 16)
on conflict (group_key, value_key) do nothing;

-- vehicle_status
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('vehicle_status', 'available', 'Available', 'success', 1),
  ('vehicle_status', 'reserved', 'Reserved', 'primary', 2),
  ('vehicle_status', 'on_trip', 'On trip', 'info', 3),
  ('vehicle_status', 'under_maintenance', 'Under maintenance', 'warning', 4),
  ('vehicle_status', 'unavailable', 'Unavailable', 'danger', 5),
  ('vehicle_status', 'out_of_service', 'Out of service', 'danger', 6),
  ('vehicle_status', 'retired', 'Retired', 'neutral', 7)
on conflict (group_key, value_key) do nothing;

-- driver_status
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('driver_status', 'available', 'Available', 'success', 1),
  ('driver_status', 'reserved', 'Reserved', 'primary', 2),
  ('driver_status', 'driving', 'Driving', 'info', 3),
  ('driver_status', 'break', 'On break', 'warning', 4),
  ('driver_status', 'off_duty', 'Off duty', 'neutral', 5),
  ('driver_status', 'leave', 'On leave', 'neutral', 6),
  ('driver_status', 'unavailable', 'Unavailable', 'danger', 7),
  ('driver_status', 'suspended', 'Suspended', 'danger', 8)
on conflict (group_key, value_key) do nothing;

-- priority
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('priority', 'normal', 'Normal', 'neutral', 1),
  ('priority', 'important', 'Important', 'info', 2),
  ('priority', 'high', 'High', 'warning', 3),
  ('priority', 'emergency', 'Emergency', 'danger', 4),
  ('priority', 'vip', 'VIP', 'primary', 5)
on conflict (group_key, value_key) do nothing;

-- trip_type (aligned with DB: one_way, round_trip, multi_stop)
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('trip_type', 'one_way', 'One-way', 'info', 1),
  ('trip_type', 'round_trip', 'Round trip', 'primary', 2),
  ('trip_type', 'multi_stop', 'Multi-stop', 'warning', 3)
on conflict (group_key, value_key) do nothing;

-- shift
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('shift', 'day', 'Day', 'warning', 1),
  ('shift', 'evening', 'Evening', 'info', 2),
  ('shift', 'night', 'Night', 'info', 3),
  ('shift', 'flexible', 'Flexible', 'neutral', 4)
on conflict (group_key, value_key) do nothing;

-- severity
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('severity', 'low', 'Low', 'neutral', 1),
  ('severity', 'medium', 'Medium', 'warning', 2),
  ('severity', 'high', 'High', 'danger', 3),
  ('severity', 'critical', 'Critical', 'danger', 4)
on conflict (group_key, value_key) do nothing;

-- roster_role
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('roster_role', 'admin_hr', 'Admin / HR', 'primary', 1),
  ('roster_role', 'driver', 'Driver', 'info', 2),
  ('roster_role', 'employee', 'Employee', 'neutral', 3)
on conflict (group_key, value_key) do nothing;

-- app_role
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('app_role', 'employee', 'Employee', 'info', 1),
  ('app_role', 'transport_admin', 'Transport admin', 'primary', 2),
  ('app_role', 'fleet_manager', 'Fleet manager', 'primary', 3),
  ('app_role', 'driver', 'Driver', 'success', 4),
  ('app_role', 'system_admin', 'System admin', 'warning', 5)
on conflict (group_key, value_key) do nothing;

-- unavailability_status
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('unavailability_status', 'pending', 'Pending review', 'warning', 1),
  ('unavailability_status', 'approved_unavailable', 'Unavailable', 'danger', 2),
  ('unavailability_status', 'sent_to_maintenance', 'In maintenance', 'info', 3),
  ('unavailability_status', 'rejected', 'Rejected', 'neutral', 4),
  ('unavailability_status', 'info_requested', 'Info requested', 'warning', 5),
  ('unavailability_status', 'resolved', 'Resolved', 'success', 6)
on conflict (group_key, value_key) do nothing;

-- vehicle_category
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('vehicle_category', 'sedan', 'Sedan', 'info', 1),
  ('vehicle_category', 'car', 'Car', 'info', 2),
  ('vehicle_category', 'suv', 'SUV', 'primary', 3),
  ('vehicle_category', 'mpv', 'MPV', 'primary', 4),
  ('vehicle_category', 'microbus', 'Microbus', 'warning', 5),
  ('vehicle_category', 'minibus', 'Minibus', 'warning', 6),
  ('vehicle_category', 'bus', 'Bus', 'warning', 7),
  ('vehicle_category', 'pickup', 'Pickup', 'neutral', 8),
  ('vehicle_category', 'ambulance', 'Ambulance', 'danger', 9),
  ('vehicle_category', 'truck', 'Truck', 'neutral', 10)
on conflict (group_key, value_key) do nothing;

-- fuel_type
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('fuel_type', 'petrol', 'Petrol', 'neutral', 1),
  ('fuel_type', 'diesel', 'Diesel', 'neutral', 2),
  ('fuel_type', 'cng', 'CNG', 'info', 3),
  ('fuel_type', 'hybrid', 'Hybrid', 'success', 4),
  ('fuel_type', 'electric', 'Electric', 'success', 5)
on conflict (group_key, value_key) do nothing;

-- ownership
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('ownership', 'owned', 'Owned', 'success', 1),
  ('ownership', 'leased', 'Leased', 'info', 2),
  ('ownership', 'rented', 'Rented', 'warning', 3)
on conflict (group_key, value_key) do nothing;

-- location_type
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('location_type', 'office', 'Office', 'primary', 1),
  ('location_type', 'factory', 'Factory', 'warning', 2),
  ('location_type', 'warehouse', 'Warehouse', 'neutral', 3),
  ('location_type', 'airport', 'Airport', 'info', 4),
  ('location_type', 'branch', 'Branch', 'info', 5),
  ('location_type', 'customer', 'Customer', 'success', 6),
  ('location_type', 'hotel', 'Hotel', 'primary', 7),
  ('location_type', 'other', 'Other', 'neutral', 8)
on conflict (group_key, value_key) do nothing;

-- passenger_type
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('passenger_type', 'employee', 'Employee', 'info', 1),
  ('passenger_type', 'guest', 'Guest', 'neutral', 2),
  ('passenger_type', 'vip', 'VIP', 'primary', 3)
on conflict (group_key, value_key) do nothing;

-- unavailability_reason
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('unavailability_reason', 'mechanical', 'Mechanical', 'danger', 1),
  ('unavailability_reason', 'tire', 'Tyre issue', 'warning', 2),
  ('unavailability_reason', 'battery', 'Battery', 'warning', 3),
  ('unavailability_reason', 'accident', 'Accident', 'danger', 4),
  ('unavailability_reason', 'maintenance', 'Scheduled maintenance', 'info', 5),
  ('unavailability_reason', 'cleaning', 'Cleaning', 'neutral', 6),
  ('unavailability_reason', 'other', 'Other', 'neutral', 7)
on conflict (group_key, value_key) do nothing;

-- route_point_type
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('route_point_type', 'pickup', 'Pickup', 'primary', 1),
  ('route_point_type', 'stop', 'Stop', 'info', 2),
  ('route_point_type', 'destination', 'Destination', 'success', 3)
on conflict (group_key, value_key) do nothing;

-- notification_category
insert into public.app_lookup_values (group_key, value_key, label, tone, sort_order) values
  ('notification_category', 'request', 'Request', 'info', 1),
  ('notification_category', 'assignment', 'Assignment', 'primary', 2),
  ('notification_category', 'trip', 'Trip', 'success', 3),
  ('notification_category', 'maintenance', 'Maintenance', 'warning', 4),
  ('notification_category', 'compliance', 'Compliance', 'danger', 5),
  ('notification_category', 'emergency', 'Emergency', 'danger', 6)
on conflict (group_key, value_key) do nothing;
