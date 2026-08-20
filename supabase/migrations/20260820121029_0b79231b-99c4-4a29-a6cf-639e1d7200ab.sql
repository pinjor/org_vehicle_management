create extension if not exists cube;
create extension if not exists earthdistance;
create type public.app_role as enum ('employee','transport_admin','fleet_manager','driver','system_admin');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.departments to authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  employee_code text,
  department_id uuid references public.departments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_dispatcher(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id
    and role in ('transport_admin','fleet_manager','system_admin'))
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_type text not null default 'office'
    check (location_type in ('office','factory','warehouse','airport','branch','customer','hotel','other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  fleet_number text not null unique,
  name text not null,
  category text not null check (category in ('sedan','suv','microbus','minibus','bus','pickup','ambulance','truck')),
  brand text not null default '',
  model text not null default '',
  model_year int,
  color text,
  seat_capacity int not null check (seat_capacity > 0),
  luggage_capacity int not null default 2,
  fuel_type text not null default 'petrol' check (fuel_type in ('petrol','diesel','cng','hybrid','electric')),
  transmission text not null default 'manual',
  has_ac boolean not null default true,
  is_vip boolean not null default false,
  ownership text not null default 'owned' check (ownership in ('owned','leased','rented')),
  branch text not null default 'Head Office',
  base_location_id uuid references public.locations(id),
  current_latitude numeric(9,6),
  current_longitude numeric(9,6),
  odometer_km int not null default 0,
  last_service_km int not null default 0,
  last_service_date date,
  service_interval_km int not null default 10000,
  registration_expiry date,
  fitness_expiry date,
  insurance_expiry date,
  tax_token_expiry date,
  operational_status text not null default 'available'
    check (operational_status in ('available','reserved','on_trip','under_maintenance','unavailable','out_of_service','retired')),
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create index idx_vehicles_status on public.vehicles(operational_status);
create trigger trg_vehicles_updated before update on public.vehicles for each row execute function public.set_updated_at();

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  driver_code text not null unique,
  full_name text not null,
  email text,
  phone text not null default '',
  alternate_phone text,
  photo_url text,
  address text,
  blood_group text,
  emergency_contact text,
  date_of_joining date,
  license_number text not null default '',
  license_type text not null default 'Professional',
  license_expiry date,
  allowed_categories text[] not null default '{sedan,suv}',
  experience_years int not null default 0,
  shift text not null default 'day' check (shift in ('day','evening','night','flexible')),
  weekly_off int[] not null default '{5}',
  base_location_id uuid references public.locations(id),
  current_status text not null default 'available'
    check (current_status in ('available','reserved','driving','break','off_duty','leave','unavailable','suspended')),
  rating numeric(2,1) not null default 4.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.drivers to authenticated;
grant all on public.drivers to service_role;
alter table public.drivers enable row level security;
create trigger trg_drivers_updated before update on public.drivers for each row execute function public.set_updated_at();

create sequence public.seq_request_no;
create sequence public.seq_trip_no;
create sequence public.seq_incident_no;
create or replace function public.next_ref(_prefix text, _seq text)
returns text language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  execute format('select nextval(%L)', _seq) into n;
  return _prefix || '-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
end; $$;

create table public.vehicle_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_ref('VR','public.seq_request_no'),
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  requester_phone text,
  department_id uuid references public.departments(id),
  cost_center text,
  purpose text not null default '',
  trip_type text not null default 'one_way' check (trip_type in ('one_way','round_trip','multi_stop')),
  priority text not null default 'normal' check (priority in ('normal','important','high','emergency','vip')),
  requested_category text,
  passenger_count int not null check (passenger_count > 0),
  journey_date date not null,
  pickup_at timestamptz not null,
  expected_end_at timestamptz not null,
  is_round_trip boolean not null default false,
  return_pickup_at timestamptz,
  return_expected_end_at timestamptz,
  requires_ac boolean not null default true,
  special_requirements text,
  remarks text,
  estimated_distance_km numeric(8,2),
  status text not null default 'draft' check (status in
    ('draft','submitted','under_review','approved','rejected','assigned','in_progress','completed','cancelled')),
  assigned_vehicle_id uuid references public.vehicles(id),
  assigned_driver_id uuid references public.drivers(id),
  assigned_at timestamptz,
  assigned_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_window check (expected_end_at > pickup_at)
);
grant select, insert, update, delete on public.vehicle_requests to authenticated;
grant all on public.vehicle_requests to service_role;
alter table public.vehicle_requests enable row level security;
create index idx_requests_status on public.vehicle_requests(status);
create index idx_requests_vehicle_window on public.vehicle_requests(assigned_vehicle_id, pickup_at, expected_end_at);
create index idx_requests_driver_window on public.vehicle_requests(assigned_driver_id, pickup_at, expected_end_at);
create trigger trg_requests_updated before update on public.vehicle_requests for each row execute function public.set_updated_at();

create table public.request_route_points (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vehicle_requests(id) on delete cascade,
  leg text not null default 'outbound' check (leg in ('outbound','return')),
  sequence int not null,
  point_type text not null check (point_type in ('pickup','stop','destination')),
  name text not null,
  address text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  expected_at timestamptz,
  instruction text,
  location_id uuid references public.locations(id),
  created_at timestamptz not null default now(),
  unique (request_id, leg, sequence)
);
grant select, insert, update, delete on public.request_route_points to authenticated;
grant all on public.request_route_points to service_role;
alter table public.request_route_points enable row level security;

create table public.request_passengers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vehicle_requests(id) on delete cascade,
  full_name text not null,
  employee_code text,
  department text,
  phone text,
  passenger_type text not null default 'employee' check (passenger_type in ('employee','guest','vip')),
  is_primary boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.request_passengers to authenticated;
grant all on public.request_passengers to service_role;
alter table public.request_passengers enable row level security;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_ref('TR','public.seq_trip_no'),
  request_id uuid not null unique references public.vehicle_requests(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  driver_id uuid not null references public.drivers(id),
  status text not null default 'driver_assigned' check (status in
    ('driver_assigned','driver_confirmed','heading_to_pickup','arrived_pickup','passenger_picked_up','in_transit',
     'stop_reached','destination_reached','passenger_dropped','return_pending','return_in_transit','completed',
     'cancelled','no_show','breakdown','emergency_stop')),
  current_leg text not null default 'outbound',
  current_stop_index int not null default 0,
  started_at timestamptz,
  arrived_pickup_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  odometer_start int,
  odometer_end int,
  distance_km numeric(8,2),
  fuel_cost numeric(10,2),
  driver_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.trips to authenticated;
grant all on public.trips to service_role;
alter table public.trips enable row level security;
create trigger trg_trips_updated before update on public.trips for each row execute function public.set_updated_at();

create table public.trip_status_history (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert on public.trip_status_history to authenticated;
grant all on public.trip_status_history to service_role;
alter table public.trip_status_history enable row level security;

create table public.vehicle_unavailability_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_ref('INC','public.seq_incident_no'),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.drivers(id),
  trip_id uuid references public.trips(id),
  reason text not null check (reason in ('mechanical','tire','battery','accident','maintenance','cleaning','other')),
  description text not null default '',
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  latitude numeric(9,6),
  longitude numeric(9,6),
  photo_url text,
  status text not null default 'pending' check (status in ('pending','approved_unavailable','sent_to_maintenance','rejected','info_requested','resolved')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.vehicle_unavailability_requests to authenticated;
grant all on public.vehicle_unavailability_requests to service_role;
alter table public.vehicle_unavailability_requests enable row level security;
create trigger trg_unav_updated before update on public.vehicle_unavailability_requests for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  audience_role public.app_role,
  category text not null default 'request' check (category in ('request','assignment','trip','maintenance','compliance','emergency')),
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create index idx_notifications_user on public.notifications(user_id, is_read);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid references auth.users(id),
  actor_name text,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);