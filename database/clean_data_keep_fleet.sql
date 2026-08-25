-- Partial clean: transactional + user data only. Keeps fleet master seed rows.
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
  public.app_users
restart identity cascade;

alter sequence if exists public.seq_request_no restart with 1;
alter sequence if exists public.seq_trip_no restart with 1;
alter sequence if exists public.seq_incident_no restart with 1;

commit;
