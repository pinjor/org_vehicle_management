-- Hide workflow statuses the app never writes / never advances to.
-- Keep DB CHECK constraints intact for any legacy rows.
update public.app_lookup_values
set is_active = false
where (group_key, value_key) in (
  ('request_status', 'draft'),
  ('request_status', 'under_review'),
  ('trip_status', 'no_show'),
  ('trip_status', 'emergency_stop'),
  ('unavailability_status', 'info_requested')
);
