revoke execute on function public.assign_request(uuid,uuid,uuid,uuid) from public, anon;
revoke execute on function public.advance_trip(uuid,text,uuid,jsonb) from public, anon;
revoke execute on function public.get_recommendations(uuid) from public, anon;
revoke execute on function public.next_ref(text,text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_dispatcher(uuid) from public, anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.assign_request(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.advance_trip(uuid,text,uuid,jsonb) to authenticated;
grant execute on function public.get_recommendations(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_dispatcher(uuid) to authenticated;
alter function public.request_window(timestamptz, timestamptz, int) set search_path = public;

insert into public.departments (name, code) values
  ('Executive Office','EXO'),('Finance & Accounts','FIN'),('Human Resources','HRD'),
  ('Supply Chain','SCM'),('Engineering','ENG'),('Sales & Marketing','SNM');

insert into public.locations (name, address, latitude, longitude, location_type) values
  ('Head Office','Gulshan Avenue, Gulshan 1, Dhaka 1212',23.780800,90.416600,'office'),
  ('Corporate Tower','Bijoy Sarani, Tejgaon, Dhaka 1215',23.762800,90.391300,'office'),
  ('Hazrat Shahjalal International Airport','Airport Road, Kurmitola, Dhaka 1229',23.843300,90.397800,'airport'),
  ('Savar Production Plant','Hemayetpur, Savar, Dhaka 1340',23.847000,90.256000,'factory'),
  ('Gazipur Factory','Konabari, Gazipur 1346',23.995000,90.373000,'factory'),
  ('Tejgaon Warehouse','Tejgaon Industrial Area, Dhaka 1208',23.765000,90.398000,'warehouse'),
  ('Chattogram Branch','Agrabad C/A, Chattogram 4100',22.328000,91.812000,'branch'),
  ('Motijheel Branch','Dilkusha C/A, Motijheel, Dhaka 1000',23.727000,90.418000,'branch'),
  ('Uttara Branch','Sector 7, Uttara, Dhaka 1230',23.874000,90.379000,'branch'),
  ('Radisson Blu Water Garden','Airport Road, Dhaka Cantonment 1206',23.822000,90.400000,'hotel'),
  ('Pan Pacific Sonargaon','Kawran Bazar, Dhaka 1215',23.751000,90.392000,'hotel'),
  ('Banani Client Office','Kemal Ataturk Avenue, Banani, Dhaka 1213',23.793000,90.404000,'customer'),
  ('Narayanganj Depot','Fatullah, Narayanganj 1400',23.620000,90.500000,'warehouse'),
  ('United Hospital','Gulshan 2, Dhaka 1212',23.803000,90.415000,'other');

insert into public.vehicles (registration_number, fleet_number, name, category, brand, model, model_year, color,
  seat_capacity, luggage_capacity, fuel_type, transmission, has_ac, is_vip, ownership, branch,
  current_latitude, current_longitude, odometer_km, last_service_km, last_service_date, service_interval_km,
  registration_expiry, fitness_expiry, insurance_expiry, tax_token_expiry, operational_status)
select r.reg, r.fleet, r.nm, r.cat, r.brand, r.model, r.yr, r.col, r.seats, r.lug, r.fuel, r.trans, r.ac, r.vip,
  r.own, r.branch, r.lat, r.lng, r.odo, r.odo - r.since_service, current_date - (r.since_service/40)::int,
  10000, current_date + 300, current_date + r.doc1, current_date + r.doc2, current_date + 240, r.status
from (values
 ('Dhaka Metro-Ga-17-4521','FL-001','Toyota Corolla Altis','sedan','Toyota','Corolla Altis',2022,'Pearl White',4,2,'petrol','automatic',true,true,'owned','Head Office',23.7808,90.4166,48210,1200,120,180,'available'),
 ('Dhaka Metro-Ga-18-1130','FL-002','Toyota Premio','sedan','Toyota','Premio',2021,'Silver',4,2,'petrol','automatic',true,true,'owned','Head Office',23.7810,90.4170,63400,3600,90,45,'available'),
 ('Dhaka Metro-Ga-19-7788','FL-003','Honda Accord','sedan','Honda','Accord',2023,'Black',4,2,'hybrid','automatic',true,true,'leased','Head Office',23.7628,90.3913,21050,900,200,260,'available'),
 ('Dhaka Metro-Ga-16-3390','FL-004','Toyota Axio','sedan','Toyota','Axio',2020,'Grey',4,2,'petrol','automatic',true,false,'owned','Motijheel',23.7270,90.4180,88700,6100,-20,150,'available'),
 ('Dhaka Metro-Ga-20-5512','FL-005','Nissan Sunny','sedan','Nissan','Sunny',2021,'White',4,2,'petrol','automatic',true,false,'owned','Uttara',23.8740,90.3790,54900,2400,140,190,'available'),
 ('Dhaka Metro-Kha-11-2244','FL-006','Toyota Land Cruiser Prado','suv','Toyota','Prado',2022,'Black',6,4,'diesel','automatic',true,true,'owned','Head Office',23.7805,90.4162,39800,1800,160,220,'available'),
 ('Dhaka Metro-Kha-12-9087','FL-007','Mitsubishi Pajero Sport','suv','Mitsubishi','Pajero Sport',2021,'Dark Blue',6,4,'diesel','automatic',true,false,'owned','Gazipur',23.9950,90.3730,72300,4900,60,120,'available'),
 ('Dhaka Metro-Kha-13-6621','FL-008','Toyota Fortuner','suv','Toyota','Fortuner',2023,'White',6,4,'diesel','automatic',true,true,'leased','Head Office',23.7930,90.4040,15600,700,210,280,'available'),
 ('Dhaka Metro-Kha-10-4455','FL-009','Ford Everest','suv','Ford','Everest',2019,'Silver',6,4,'diesel','automatic',true,false,'owned','Savar',23.8470,90.2560,105400,8300,-45,80,'under_maintenance'),
 ('Dhaka Metro-Cha-51-0091','FL-010','Toyota Hiace GL','microbus','Toyota','Hiace',2022,'White',12,6,'diesel','manual',true,false,'owned','Head Office',23.7815,90.4155,58900,2100,150,200,'available'),
 ('Dhaka Metro-Cha-51-0092','FL-011','Toyota Hiace Super GL','microbus','Toyota','Hiace',2023,'White',12,6,'diesel','manual',true,false,'owned','Head Office',23.7822,90.4001,27400,1100,190,250,'available'),
 ('Dhaka Metro-Cha-52-3341','FL-012','Nissan Urvan','microbus','Nissan','Urvan',2020,'White',11,5,'diesel','manual',true,false,'owned','Tejgaon',23.7650,90.3980,91200,5600,30,95,'available'),
 ('Dhaka Metro-Cha-52-3342','FL-013','Toyota Noah','microbus','Toyota','Noah',2021,'Pearl White',7,4,'hybrid','automatic',true,false,'owned','Uttara',23.8745,90.3795,64100,3300,110,160,'available'),
 ('Dhaka Metro-Cha-53-7710','FL-014','Toyota Hiace Commuter','microbus','Toyota','Hiace',2019,'White',14,6,'diesel','manual',true,false,'owned','Savar',23.8465,90.2565,132700,9700,-10,70,'available'),
 ('Dhaka Metro-Cha-53-7711','FL-015','Hyundai H-1','microbus','Hyundai','H-1',2022,'Grey',9,5,'diesel','automatic',true,true,'leased','Head Office',23.8033,90.4152,33500,1500,175,230,'available'),
 ('Dhaka Metro-Ja-31-1198','FL-016','Ashok Leyland Staff Bus','minibus','Ashok Leyland','Falcon',2018,'Blue',30,10,'diesel','manual',true,false,'owned','Gazipur',23.9945,90.3735,214000,15200,-60,55,'available'),
 ('Dhaka Metro-Ja-31-1199','FL-017','Tata Staff Bus','minibus','Tata','LP 709',2019,'Blue',26,8,'diesel','manual',false,false,'owned','Savar',23.8472,90.2558,187400,13800,-30,65,'available'),
 ('Dhaka Metro-Ja-32-4407','FL-018','Hino Employee Coach','bus','Hino','AK1J',2020,'White',45,14,'diesel','manual',true,false,'owned','Gazipur',23.9960,90.3720,163200,11400,20,100,'available'),
 ('Dhaka Metro-Ja-32-4408','FL-019','Ashok Leyland Coach','bus','Ashok Leyland','Viking',2017,'White',40,12,'diesel','manual',false,false,'owned','Narayanganj',23.6200,90.5000,248900,17600,-80,40,'out_of_service'),
 ('Dhaka Metro-Na-19-2265','FL-020','Toyota Hilux','pickup','Toyota','Hilux',2021,'Silver',4,8,'diesel','manual',false,false,'owned','Tejgaon',23.7655,90.3985,79800,4400,80,135,'available'),
 ('Dhaka Metro-Na-19-2266','FL-021','Isuzu D-Max','pickup','Isuzu','D-Max',2022,'White',4,8,'diesel','manual',false,false,'owned','Narayanganj',23.6205,90.4995,45600,2000,145,205,'available'),
 ('Dhaka Metro-Ta-14-8834','FL-022','Toyota Ambulance','ambulance','Toyota','Hiace Ambulance',2021,'White',6,3,'diesel','manual',true,false,'owned','Head Office',23.8030,90.4155,37200,1600,165,215,'available'),
 ('Dhaka Metro-Ga-21-9903','FL-023','Honda City','sedan','Honda','City',2023,'Modern Steel',4,2,'petrol','automatic',true,false,'owned','Motijheel',23.7275,90.4185,12300,600,220,290,'available'),
 ('Dhaka Metro-Kha-14-3372','FL-024','Kia Sportage','suv','Kia','Sportage',2023,'Gravity Grey',5,3,'petrol','automatic',true,false,'leased','Head Office',23.7800,90.4160,18700,800,205,270,'available'),
 ('Chatta Metro-Cha-11-5566','FL-025','Toyota Hiace Chattogram','microbus','Toyota','Hiace',2020,'White',12,6,'diesel','manual',true,false,'owned','Chattogram',22.3280,91.8120,98400,6300,25,110,'available')
) as r(reg,fleet,nm,cat,brand,model,yr,col,seats,lug,fuel,trans,ac,vip,own,branch,lat,lng,odo,since_service,doc1,doc2,status);

insert into public.drivers (driver_code, full_name, phone, license_number, license_type, license_expiry,
  allowed_categories, experience_years, shift, current_status, rating, date_of_joining, blood_group, emergency_contact)
select d.code, d.nm, d.phone, d.lic, 'Professional', current_date + d.lic_days, d.cats, d.exp, d.shift, d.status, d.rating,
  current_date - (d.exp * 365 - 40), d.blood, d.emg
from (values
 ('DRV-001','Md. Rahim Ahmed','+8801711234501','DL-1102-345601',420,array['sedan','suv','microbus'],12,'day','available',4.9,'B+','+8801711999001'),
 ('DRV-002','Abdul Karim Sheikh','+8801711234502','DL-1102-345602',380,array['sedan','suv'],9,'day','available',4.7,'O+','+8801711999002'),
 ('DRV-003','Mizanur Rahman','+8801711234503','DL-1102-345603',150,array['microbus','minibus'],14,'day','available',4.8,'A+','+8801711999003'),
 ('DRV-004','Shafiqul Islam','+8801711234504','DL-1102-345604',600,array['sedan','suv','microbus'],7,'evening','available',4.5,'B-','+8801711999004'),
 ('DRV-005','Jashim Uddin','+8801711234505','DL-1102-345605',95,array['minibus','bus'],18,'day','available',4.6,'O-','+8801711999005'),
 ('DRV-006','Nazrul Islam Khan','+8801711234506','DL-1102-345606',270,array['sedan','suv'],11,'day','available',4.8,'AB+','+8801711999006'),
 ('DRV-007','Delwar Hossain','+8801711234507','DL-1102-345607',330,array['microbus','pickup'],6,'night','off_duty',4.3,'A-','+8801711999007'),
 ('DRV-008','Kamrul Hasan','+8801711234508','DL-1102-345608',-15,array['sedan','suv'],10,'day','available',4.4,'B+','+8801711999008'),
 ('DRV-009','Ripon Mia','+8801711234509','DL-1102-345609',510,array['microbus','minibus','bus'],16,'day','available',4.9,'O+','+8801711999009'),
 ('DRV-010','Selim Reza','+8801711234510','DL-1102-345610',210,array['sedan'],5,'evening','available',4.2,'A+','+8801711999010'),
 ('DRV-011','Anwar Hossain','+8801711234511','DL-1102-345611',440,array['suv','pickup'],13,'day','available',4.7,'B+','+8801711999011'),
 ('DRV-012','Faruk Ahmed','+8801711234512','DL-1102-345612',175,array['sedan','microbus'],8,'day','leave',4.5,'O+','+8801711999012'),
 ('DRV-013','Sohel Rana','+8801711234513','DL-1102-345613',290,array['microbus','minibus'],9,'night','available',4.6,'AB-','+8801711999013'),
 ('DRV-014','Habibur Rahman','+8801711234514','DL-1102-345614',360,array['bus','minibus'],20,'day','available',4.9,'A+','+8801711999014'),
 ('DRV-015','Jamal Uddin Bhuiyan','+8801711234515','DL-1102-345615',120,array['sedan','suv','microbus'],15,'day','available',4.8,'B-','+8801711999015'),
 ('DRV-016','Rafiqul Islam','+8801711234516','DL-1102-345616',480,array['pickup','microbus'],7,'day','available',4.4,'O+','+8801711999016'),
 ('DRV-017','Belal Hossain','+8801711234517','DL-1102-345617',230,array['sedan','suv'],6,'evening','available',4.3,'A-','+8801711999017'),
 ('DRV-018','Monir Hossain','+8801711234518','DL-1102-345618',390,array['microbus','ambulance'],11,'day','available',4.7,'B+','+8801711999018'),
 ('DRV-019','Alamgir Kabir','+8801711234519','DL-1102-345619',65,array['sedan','suv','microbus'],17,'day','available',4.9,'O-','+8801711999019'),
 ('DRV-020','Sirajul Islam','+8801711234520','DL-1102-345620',540,array['minibus','bus'],19,'day','available',4.6,'A+','+8801711999020'),
 ('DRV-021','Tanvir Hasan','+8801711234521','DL-1102-345621',300,array['sedan'],4,'day','available',4.1,'B+','+8801711999021'),
 ('DRV-022','Golam Mostafa','+8801711234522','DL-1102-345622',410,array['suv','microbus'],12,'day','available',4.8,'AB+','+8801711999022'),
 ('DRV-023','Nurul Amin','+8801711234523','DL-1102-345623',185,array['microbus','minibus'],10,'night','off_duty',4.5,'O+','+8801711999023'),
 ('DRV-024','Aminul Haque','+8801711234524','DL-1102-345624',250,array['sedan','suv'],8,'day','available',4.6,'A-','+8801711999024'),
 ('DRV-025','Shahin Alam','+8801711234525','DL-1102-345625',470,array['pickup','suv'],9,'day','available',4.4,'B-','+8801711999025'),
 ('DRV-026','Masud Parvez','+8801711234526','DL-1102-345626',140,array['microbus','minibus'],13,'day','available',4.7,'O+','+8801711999026'),
 ('DRV-027','Iqbal Hossain','+8801711234527','DL-1102-345627',520,array['sedan','suv','microbus'],14,'flexible','available',4.9,'A+','+8801711999027'),
 ('DRV-028','Rubel Mia','+8801711234528','DL-1102-345628',80,array['pickup','microbus'],5,'evening','available',4.2,'B+','+8801711999028'),
 ('DRV-029','Saiful Islam','+8801711234529','DL-1102-345629',345,array['bus','minibus'],16,'day','unavailable',4.5,'O-','+8801711999029'),
 ('DRV-030','Zakir Hossain','+8801711234530','DL-1102-345630',260,array['sedan','suv'],11,'day','available',4.8,'AB-','+8801711999030')
) as d(code,nm,phone,lic,lic_days,cats,exp,shift,status,rating,blood,emg);

insert into public.vehicle_requests (requester_name, requester_phone, department_id, cost_center, purpose, trip_type,
  priority, requested_category, passenger_count, journey_date, pickup_at, expected_end_at, is_round_trip,
  return_pickup_at, return_expected_end_at, requires_ac, special_requirements, remarks, estimated_distance_km, status)
select q.nm, q.phone, (select id from public.departments where code = q.dept), q.cc, q.purpose, q.ttype, q.prio, q.cat,
  q.pax, (current_date + q.day_offset), (current_date + q.day_offset) + q.pickup, (current_date + q.day_offset) + q.finish,
  q.round, case when q.round then (current_date + q.day_offset) + q.ret_start end,
  case when q.round then (current_date + q.day_offset) + q.ret_end end,
  true, q.special, q.remarks, q.dist, q.status
from (values
 ('Md. Karim Chowdhury','+8801811000101','EXO','CC-EXO-01','Airport pickup for visiting board member','round_trip','vip','sedan',3,0,interval '8 hours 30 minutes',interval '11 hours',true,interval '18 hours',interval '20 hours','Meet & greet at arrival gate','Guest arriving on EK-586',42.5,'submitted'),
 ('Nusrat Jahan','+8801811000102','HRD','CC-HRD-04','Staff transport to Gazipur factory orientation','one_way','normal','microbus',11,0,interval '9 hours',interval '13 hours',false,null,null,'Extra luggage space for training kits','New joiner batch of November',38.0,'submitted'),
 ('Tanjila Rahman','+8801811000103','FIN','CC-FIN-02','Bank documents delivery to Motijheel','one_way','important','sedan',2,0,interval '10 hours',interval '12 hours 30 minutes',false,null,null,null,'Cash cheque handover',14.2,'approved'),
 ('Arif Mahmud','+8801811000104','SCM','CC-SCM-07','Vendor audit visit at Savar plant','multi_stop','high','suv',5,0,interval '7 hours 45 minutes',interval '15 hours',false,null,null,'Two intermediate stops','Audit team with equipment',66.0,'submitted'),
 ('Sabbir Ahmed','+8801811000105','ENG','CC-ENG-03','Site inspection at Narayanganj depot','round_trip','normal','pickup',3,1,interval '8 hours',interval '12 hours',true,interval '14 hours',interval '17 hours','Tools in cargo bed','Monthly inspection',52.0,'submitted'),
 ('Farhana Islam','+8801811000106','SNM','CC-SNM-05','Client presentation at Banani office','one_way','important','sedan',3,1,interval '9 hours 30 minutes',interval '12 hours',false,null,null,null,'Bring pitch materials',9.4,'submitted'),
 ('Imran Hossain','+8801811000107','EXO','CC-EXO-01','Managing Director city meetings','multi_stop','vip','suv',2,1,interval '10 hours',interval '17 hours',false,null,null,'VIP protocol, senior driver required','Three meeting locations',48.0,'submitted'),
 ('Shirin Akter','+8801811000108','HRD','CC-HRD-04','Employee medical emergency transfer','one_way','emergency','ambulance',2,0,interval '6 hours',interval '8 hours',false,null,null,'Stretcher required','Transfer to United Hospital',7.8,'approved'),
 ('Rezaul Karim','+8801811000109','SCM','CC-SCM-07','Warehouse stock transfer supervision','one_way','normal','pickup',2,2,interval '8 hours 15 minutes',interval '13 hours',false,null,null,null,null,29.0,'submitted'),
 ('Mahmudul Hasan','+8801811000110','ENG','CC-ENG-03','Engineering team to Gazipur commissioning','round_trip','high','microbus',9,2,interval '7 hours',interval '16 hours',true,interval '17 hours',interval '19 hours 30 minutes',null,'Full-day commissioning support',84.0,'submitted'),
 ('Kaniz Fatema','+8801811000111','FIN','CC-FIN-02','Quarterly audit team pickup from hotel','one_way','important','microbus',7,-1,interval '8 hours',interval '10 hours',false,null,null,null,'External auditors',11.0,'completed'),
 ('Ashraful Alam','+8801811000112','SNM','CC-SNM-05','Regional dealer meet transport','one_way','normal','minibus',24,-2,interval '7 hours 30 minutes',interval '18 hours',false,null,null,null,'Dealer conference',95.0,'completed')
) as q(nm,phone,dept,cc,purpose,ttype,prio,cat,pax,day_offset,pickup,finish,round,ret_start,ret_end,special,remarks,dist,status);

insert into public.request_route_points (request_id, leg, sequence, point_type, name, address, latitude, longitude)
select r.id, 'outbound', 1, 'pickup', l.name, l.address, l.latitude, l.longitude
from public.vehicle_requests r
join public.locations l on l.name = case
  when r.purpose like 'Airport pickup%' then 'Hazrat Shahjalal International Airport'
  when r.purpose like 'Employee medical%' then 'Corporate Tower'
  when r.purpose like 'Quarterly audit%' then 'Pan Pacific Sonargaon'
  else 'Head Office' end;

insert into public.request_route_points (request_id, leg, sequence, point_type, name, address, latitude, longitude)
select r.id, 'outbound', 2, 'stop', l.name, l.address, l.latitude, l.longitude
from public.vehicle_requests r
join public.locations l on l.name = 'Tejgaon Warehouse'
where r.trip_type = 'multi_stop';

insert into public.request_route_points (request_id, leg, sequence, point_type, name, address, latitude, longitude)
select r.id, 'outbound', case when r.trip_type = 'multi_stop' then 3 else 2 end, 'destination',
  l.name, l.address, l.latitude, l.longitude
from public.vehicle_requests r
join public.locations l on l.name = case
  when r.purpose like 'Airport pickup%' then 'Head Office'
  when r.purpose like 'Staff transport%' or r.purpose like 'Engineering team%' then 'Gazipur Factory'
  when r.purpose like 'Bank documents%' then 'Motijheel Branch'
  when r.purpose like 'Vendor audit%' then 'Savar Production Plant'
  when r.purpose like 'Site inspection%' or r.purpose like 'Warehouse stock%' then 'Narayanganj Depot'
  when r.purpose like 'Client presentation%' then 'Banani Client Office'
  when r.purpose like 'Managing Director%' then 'Corporate Tower'
  when r.purpose like 'Employee medical%' then 'United Hospital'
  when r.purpose like 'Quarterly audit%' then 'Head Office'
  else 'Uttara Branch' end;

insert into public.request_passengers (request_id, full_name, employee_code, department, phone, passenger_type, is_primary)
select r.id, r.requester_name, 'EMP-' || lpad((row_number() over (order by r.created_at))::text, 4, '0'),
  d.name, r.requester_phone, case when r.priority = 'vip' then 'vip' else 'employee' end, true
from public.vehicle_requests r left join public.departments d on d.id = r.department_id;