-- Optional reference organization. No users or elevated roles are created automatically.
insert into public.organizations(id,name) values('a1000000-0000-4000-8000-000000000001','Astana IT University') on conflict do nothing;
insert into public.locations(id,organization_id,name,building,floor,address,latitude,longitude) values
('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','University Library','C1','2','Mangilik El avenue, Astana',51.0901,71.4184),
('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Main Security Desk','C1','1','Mangilik El avenue, Astana',51.0902,71.4185)
on conflict do nothing;
