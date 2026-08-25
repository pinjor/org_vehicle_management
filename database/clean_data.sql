-- Wipe all row data: requests, trips, users, roster, fleet seed, departments, locations.
-- Schema, functions, and policies are unchanged.
\set ON_ERROR_STOP on

begin;

truncate table
  public.audit_logs,
  public.notifications,
  public.trip_status_history,
  public.trips,
  public.request_passengers,
  public.request_route_points,
  public.vehicle_unavailability_requests,
  public.vehicle_requests,
  public.user_roster,
  public.user_roles,
  public.profiles,
  public.drivers,
  public.vehicles,
  public.locations,
  public.departments,
  public.app_users
restart identity cascade;

alter sequence if exists public.seq_request_no restart with 1;
alter sequence if exists public.seq_trip_no restart with 1;
alter sequence if exists public.seq_incident_no restart with 1;

commit;
