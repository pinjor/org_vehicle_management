-- Starter data after db:clean — admin roster, departments, locations, fleet sample.
-- Admin sign-up: phone 1711000001 (+8801711000001) on user_roster as admin_hr.
\set ON_ERROR_STOP on

begin;

insert into public.departments (name, code) values
  ('Executive Office', 'EXO'),
  ('Finance & Accounts', 'FIN'),
  ('Human Resources', 'HRD'),
  ('Supply Chain', 'SCM'),
  ('Engineering', 'ENG'),
  ('Sales & Marketing', 'SNM')
on conflict do nothing;

-- OSM-geocoded Dhaka / BD landmarks (Nominatim). Skip if name already exists.
insert into public.locations (name, address, latitude, longitude, location_type)
select v.name, v.address, v.lat, v.lng, v.loc_type
from (values
  ('Head Office', 'Gulshan Avenue, Gulshan 1, Dhaka 1212', 23.772643, 90.414826, 'office'),
  ('Corporate Tower', 'Bijoy Sarani, Tejgaon, Dhaka 1215', 23.766394, 90.383097, 'office'),
  ('Hazrat Shahjalal International Airport', 'Airport Road, Kurmitola, Dhaka 1229', 23.843144, 90.405303, 'airport'),
  ('Savar Production Plant', 'Hemayetpur, Savar, Dhaka 1340', 23.805450, 90.260996, 'factory'),
  ('Gazipur Factory', 'Konabari, Gazipur 1346', 24.013143, 90.308134, 'factory'),
  ('Tejgaon Warehouse', 'Tejgaon Industrial Area, Dhaka 1208', 23.764878, 90.405798, 'warehouse'),
  ('Chattogram Branch', 'Agrabad C/A, Chattogram 4100', 22.327821, 91.817161, 'branch'),
  ('Motijheel Branch', 'Dilkusha C/A, Motijheel, Dhaka 1000', 23.727260, 90.421196, 'branch'),
  ('Uttara Branch', 'Sector 7, Uttara, Dhaka 1230', 23.871201, 90.397187, 'branch'),
  ('Radisson Blu Water Garden', 'Airport Road, Dhaka Cantonment 1206', 23.816035, 90.408701, 'hotel'),
  ('Pan Pacific Sonargaon', 'Kawran Bazar, Dhaka 1215', 23.749573, 90.394873, 'hotel'),
  ('Banani Client Office', 'Kemal Ataturk Avenue, Banani, Dhaka 1213', 23.790321, 90.407696, 'customer'),
  ('Narayanganj Depot', 'Fatullah, Narayanganj 1400', 23.650351, 90.475788, 'warehouse'),
  ('United Hospital', 'Gulshan 2, Dhaka 1212', 23.804830, 90.415621, 'other')
) as v(name, address, lat, lng, loc_type)
where not exists (
  select 1 from public.locations l where l.name = v.name and l.is_active = true
);

insert into public.vehicles (
  registration_number, fleet_number, name, category, brand, model, model_year, color,
  seat_capacity, luggage_capacity, fuel_type, transmission, has_ac, is_vip, ownership, branch,
  current_latitude, current_longitude, odometer_km, last_service_km, last_service_date, service_interval_km,
  registration_expiry, fitness_expiry, insurance_expiry, tax_token_expiry, operational_status
)
select r.reg, r.fleet, r.nm, r.cat, r.brand, r.model, r.yr, r.col, r.seats, r.lug, r.fuel, r.trans, r.ac, r.vip,
  r.own, r.branch, r.lat, r.lng, r.odo, r.odo - r.since_service, current_date - (r.since_service / 40)::int,
  10000, current_date + 300, current_date + r.doc1, current_date + r.doc2, current_date + 240, r.status
from (values
  ('Dhaka Metro-Ga-17-4521', 'FL-001', 'Toyota Corolla Altis', 'sedan', 'Toyota', 'Corolla Altis', 2022, 'Pearl White', 4, 2, 'petrol', 'automatic', true, true, 'owned', 'Head Office', 23.7808, 90.4166, 48210, 1200, 120, 180, 'available'),
  ('Dhaka Metro-Ga-18-1130', 'FL-002', 'Toyota Premio', 'sedan', 'Toyota', 'Premio', 2021, 'Silver', 4, 2, 'petrol', 'automatic', true, true, 'owned', 'Head Office', 23.7810, 90.4170, 63400, 3600, 90, 45, 'available'),
  ('Dhaka Metro-Kha-11-2244', 'FL-006', 'Toyota Land Cruiser Prado', 'suv', 'Toyota', 'Prado', 2022, 'Black', 6, 4, 'diesel', 'automatic', true, true, 'owned', 'Head Office', 23.7805, 90.4162, 39800, 1800, 160, 220, 'available'),
  ('Dhaka Metro-Cha-51-0091', 'FL-010', 'Toyota Hiace GL', 'microbus', 'Toyota', 'Hiace', 2022, 'White', 12, 6, 'diesel', 'manual', true, false, 'owned', 'Head Office', 23.7815, 90.4155, 58900, 2100, 150, 200, 'available'),
  ('Dhaka Metro-Cha-51-0092', 'FL-011', 'Toyota Hiace Super GL', 'microbus', 'Toyota', 'Hiace', 2023, 'White', 12, 6, 'diesel', 'manual', true, false, 'owned', 'Head Office', 23.7822, 90.4001, 27400, 1100, 190, 250, 'available'),
  ('Dhaka Metro-Ja-31-1198', 'FL-016', 'Ashok Leyland Staff Bus', 'minibus', 'Ashok Leyland', 'Falcon', 2018, 'Blue', 30, 10, 'diesel', 'manual', true, false, 'owned', 'Gazipur', 23.9945, 90.3735, 214000, 15200, -60, 55, 'available'),
  ('Dhaka Metro-Na-19-2265', 'FL-020', 'Toyota Hilux', 'pickup', 'Toyota', 'Hilux', 2021, 'Silver', 4, 8, 'diesel', 'manual', false, false, 'owned', 'Tejgaon', 23.7655, 90.3985, 79800, 4400, 80, 135, 'available'),
  ('Dhaka Metro-Ta-14-8834', 'FL-022', 'Toyota Ambulance', 'ambulance', 'Toyota', 'Hiace Ambulance', 2021, 'White', 6, 3, 'diesel', 'manual', true, false, 'owned', 'Head Office', 23.8030, 90.4155, 37200, 1600, 165, 215, 'available')
) as r(reg, fleet, nm, cat, brand, model, yr, col, seats, lug, fuel, trans, ac, vip, own, branch, lat, lng, odo, since_service, doc1, doc2, status)
where not exists (select 1 from public.vehicles v where v.fleet_number = r.fleet);

insert into public.drivers (
  driver_code, full_name, phone, license_number, license_type, license_expiry,
  allowed_categories, experience_years, shift, current_status, rating, date_of_joining, blood_group, emergency_contact
)
select d.code, d.nm, d.phone, d.lic, 'Professional', current_date + d.lic_days, d.cats, d.exp, d.shift, d.status, d.rating,
  current_date - (d.exp * 365 - 40), d.blood, d.emg
from (values
  ('DRV-001', 'Md. Rahim Ahmed', '+8801711234501', 'DL-1102-345601', 420, array['sedan', 'suv', 'microbus'], 12, 'day', 'available', 4.9, 'B+', '+8801711999001'),
  ('DRV-002', 'Abdul Karim Sheikh', '+8801711234502', 'DL-1102-345602', 380, array['sedan', 'suv'], 9, 'day', 'available', 4.7, 'O+', '+8801711999002'),
  ('DRV-003', 'Mizanur Rahman', '+8801711234503', 'DL-1102-345603', 150, array['microbus', 'minibus'], 14, 'day', 'available', 4.8, 'A+', '+8801711999003'),
  ('DRV-004', 'Shafiqul Islam', '+8801711234504', 'DL-1102-345604', 600, array['sedan', 'suv', 'microbus'], 7, 'evening', 'available', 4.5, 'B-', '+8801711999004'),
  ('DRV-005', 'Jashim Uddin', '+8801711234505', 'DL-1102-345605', 95, array['minibus', 'bus'], 18, 'day', 'available', 4.6, 'O-', '+8801711999005'),
  ('DRV-006', 'Nazrul Islam Khan', '+8801711234506', 'DL-1102-345606', 270, array['sedan', 'suv'], 11, 'day', 'available', 4.8, 'AB+', '+8801711999006')
) as d(code, nm, phone, lic, lic_days, cats, exp, shift, status, rating, blood, emg)
where not exists (select 1 from public.drivers dr where dr.driver_code = d.code);

-- Stick vehicles to primary drivers (1:1). Unpaired units need a link before assign.
update public.vehicles v
set primary_driver_id = d.id
from public.drivers d
where v.primary_driver_id is null
  and (
    (v.fleet_number = 'FL-001' and d.driver_code = 'DRV-001')
    or (v.fleet_number = 'FL-002' and d.driver_code = 'DRV-002')
    or (v.fleet_number = 'FL-006' and d.driver_code = 'DRV-006')
    or (v.fleet_number = 'FL-010' and d.driver_code = 'DRV-003')
    or (v.fleet_number = 'FL-011' and d.driver_code = 'DRV-004')
    or (v.fleet_number = 'FL-016' and d.driver_code = 'DRV-005')
  );

-- Roster: only listed phones may create accounts.
insert into public.user_roster (full_name, phone, role) values
  ('Transport Admin', '+8801711000001', 'admin_hr'),
  ('Sadia Rahman', '+8801712000001', 'employee'),
  ('Karim Hassan', '+8801712000002', 'employee'),
  ('Nusrat Jahan', '+8801712000003', 'employee'),
  ('Arif Mahmud', '+8801712000004', 'employee'),
  ('Tanjila Rahman', '+8801712000005', 'employee')
on conflict (phone) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true,
  user_id = null;

insert into public.user_roster (full_name, phone, role)
select d.full_name, public.normalize_bd_phone(d.phone), 'driver'::public.roster_role
from public.drivers d
where public.normalize_bd_phone(d.phone) is not null
on conflict (phone) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = true;

commit;
