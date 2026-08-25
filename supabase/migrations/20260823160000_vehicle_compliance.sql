-- Expand vehicle types and add repair tracking fields
alter table public.vehicles drop constraint if exists vehicles_category_check;
alter table public.vehicles add constraint vehicles_category_check
  check (category in ('sedan','suv','car','microbus','minibus','bus','pickup','ambulance','truck','mpv'));

alter table public.vehicles add column if not exists last_repair_date date;
alter table public.vehicles add column if not exists last_repair_summary text;
