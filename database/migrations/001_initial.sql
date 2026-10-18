BEGIN;
-- Apply in the Supabase SQL editor or with psql. All API mutations use the service role.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 full_name text not null default '', role text not null default 'USER' check(role in ('USER','PLATFORM_ADMIN')),
 created_at timestamptz not null default now()
);
create function public.on_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100)); return new; end $$;
create trigger auth_signup after insert on auth.users for each row execute function public.on_signup();
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.staff_members(organization_id uuid references organizations on delete cascade,user_id uuid references profiles on delete cascade,role text not null check(role in ('STAFF','ORG_ADMIN')), primary key(organization_id,user_id));
create table public.locations(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations,name text not null,building text not null default '',floor text not null default '',address text not null default '',latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),active boolean not null default true);
create table public.reports(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,organization_id uuid not null references organizations,location_id uuid not null references locations,
 type text not null check(type in ('LOST','FOUND')),category text not null,item_name text not null check(length(item_name) between 2 and 120),brand text not null default '',color text not null,description text not null default '',unique_features jsonb not null default '[]',
 latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
 geo extensions.geography(Point,4326) generated always as (case when latitude is not null and longitude is not null then extensions.st_setsrid(extensions.st_makepoint(longitude,latitude),4326)::extensions.geography end) stored,
 event_at timestamptz not null,reward numeric not null default 0 check(reward>=0),storage_location text not null default '',
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','FOUND','STORED','MATCH_FOUND','VERIFYING','CLAIMED','RETURNED','CLOSED')),
 ai_description text,ai_features jsonb not null default '[]',ai_state text not null default 'PENDING' check(ai_state in ('PENDING','DONE','FAILED')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index reports_geo on reports using gist(geo);
create index reports_matching on reports(type,status,category,event_at);
create index reports_owner on reports(user_id,created_at desc);
create index reports_org on reports(organization_id,created_at desc);
create table public.report_images(id uuid primary key default gen_random_uuid(),report_id uuid not null references reports on delete cascade,storage_path text not null unique,thumbnail_path text not null,created_at timestamptz not null default now());
create table public.ownership_challenges(report_id uuid primary key references reports on delete cascade,question text not null,answer_hash text not null);
create table public.matches(
 id uuid primary key default gen_random_uuid(),lost_report_id uuid not null references reports,found_report_id uuid not null references reports,
 visual_score numeric not null check(visual_score between 0 and 40),location_score numeric not null check(location_score between 0 and 30),time_score numeric not null check(time_score between 0 and 20),feature_score numeric not null check(feature_score between 0 and 10),total_score numeric not null check(total_score between 0 and 100),
 status text not null default 'PROPOSED' check(status in ('PROPOSED','VERIFYING','VERIFIED','REJECTED','RETURNED')),created_at timestamptz not null default now(), unique(lost_report_id,found_report_id)
);
create table public.ownership_verifications(id uuid primary key default gen_random_uuid(),match_id uuid not null unique references matches,user_id uuid not null references profiles,attempts integer not null default 0,status text not null default 'PENDING',created_at timestamptz not null default now());
create table public.messages(id uuid primary key default gen_random_uuid(),match_id uuid not null references matches,sender_id uuid not null references profiles,message text not null check(length(message) between 1 and 4000),created_at timestamptz not null default now());
create index messages_thread on messages(match_id,created_at);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,type text not null,title text not null,message text not null,data jsonb not null default '{}',read boolean not null default false,created_at timestamptz not null default now());
create index notifications_owner on notifications(user_id,created_at desc);
create table public.push_tokens(user_id uuid references profiles on delete cascade,token text primary key,created_at timestamptz not null default now());
create table public.jobs(id uuid primary key default gen_random_uuid(),report_id uuid not null unique references reports on delete cascade,state text not null default 'PENDING',attempts integer not null default 0,locked_at timestamptz,last_error text,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references profiles,action text not null,entity_id uuid,created_at timestamptz not null default now());
-- SECURITY DEFINER helpers have a fixed search path and never trust editable auth metadata.
create function public.is_staff(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from staff_members where organization_id=org and user_id=auth.uid()) or exists(select 1 from profiles where id=auth.uid() and role='PLATFORM_ADMIN') $$;
create function public.in_match(mid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id where m.id=mid and (l.user_id=auth.uid() or f.user_id=auth.uid() or is_staff(f.organization_id))) $$;
alter table profiles enable row level security;
create policy own_profile on profiles for select to authenticated using(id=auth.uid());
alter table organizations enable row level security;
create policy organizations_read on organizations for select to authenticated using(true);
alter table locations enable row level security;
create policy locations_read on locations for select to authenticated using(active or is_staff(organization_id));
alter table staff_members enable row level security;
create policy own_membership on staff_members for select to authenticated using(user_id=auth.uid());
alter table reports enable row level security;
create policy reports_private on reports for select to authenticated using(user_id=auth.uid() or is_staff(organization_id));
alter table report_images enable row level security;
create policy images_private on report_images for select to authenticated using(exists(select 1 from reports where id=report_id and (user_id=auth.uid() or is_staff(organization_id))));
alter table matches enable row level security;
create policy matches_private on matches for select to authenticated using(in_match(id));
alter table messages enable row level security;
create policy messages_private on messages for select to authenticated using(in_match(match_id) and exists(select 1 from matches where id=match_id and status in ('VERIFIED','RETURNED')));
alter table notifications enable row level security;
create policy notifications_private on notifications for select to authenticated using(user_id=auth.uid());
alter table ownership_challenges enable row level security;
alter table ownership_verifications enable row level security;
alter table push_tokens enable row level security;
alter table audit_logs enable row level security;
alter table jobs enable row level security;
-- No client mutations: these must pass API validation, authorization and audit rules.
revoke all on all tables in schema public from anon,authenticated;
grant select on profiles,organizations,locations,staff_members,reports,report_images,matches,messages,notifications to authenticated;
grant all on all tables in schema public to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('item-images','item-images',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- No storage client policy: API validates bytes and issues short-lived signed URLs.
create function public.set_challenge(rid uuid,q text,a text) returns void language sql set search_path=public,extensions as $$ insert into ownership_challenges values(rid,q,extensions.crypt(encode(extensions.digest(lower(trim(a)),'sha256'),'hex'),extensions.gen_salt('bf',10))) $$;
create function public.publish_report(rid uuid,actor uuid) returns void language plpgsql set search_path=public as $$
declare r reports; begin
 select * into r from reports where id=rid for update;
 if r.user_id is distinct from actor or r.status<>'DRAFT' then raise exception 'Invalid report'; end if;
 if r.type='FOUND' and (not exists(select 1 from report_images where report_id=rid) or not exists(select 1 from ownership_challenges where report_id=rid)) then raise exception 'Photo and ownership challenge required'; end if;
 update reports set status=case when type='LOST' then 'ACTIVE' else 'FOUND' end,updated_at=now() where id=rid;
 insert into jobs(report_id) values(rid) on conflict(report_id) do update set state='PENDING',attempts=0;
 insert into audit_logs(actor_id,action,entity_id) values(actor,'REPORT_PUBLISHED',rid);
end $$;
create function public.confirm_match(mid uuid,actor uuid) returns void language plpgsql set search_path=public as $$
declare m matches; begin
 select * into m from matches where id=mid for update;
 if m.status<>'PROPOSED' or not exists(select 1 from reports where id=m.found_report_id and status in ('FOUND','STORED','MATCH_FOUND')) or not exists(select 1 from reports where id=m.lost_report_id and user_id=actor and status not in ('RETURNED','CLOSED')) then raise exception 'Invalid transition'; end if;
 update matches set status='VERIFYING' where id=mid;
 insert into ownership_verifications(match_id,user_id) values(mid,actor) on conflict do nothing;
 update reports set status='VERIFYING' where id=m.lost_report_id;
 insert into audit_logs(actor_id,action,entity_id) values(actor,'MATCH_CONFIRMED',mid);
end $$;
create function public.verify_ownership(mid uuid,actor uuid,answer text) returns boolean language plpgsql set search_path=public,extensions as $$
declare m matches; v ownership_verifications; c ownership_challenges; begin
 select * into m from matches where id=mid for update;
 select * into v from ownership_verifications where match_id=mid for update;
 if m.status is distinct from 'VERIFYING' or v.user_id is distinct from actor or v.attempts>=5 then return false; end if;
 select * into c from ownership_challenges where report_id=m.found_report_id;
 update ownership_verifications set attempts=attempts+1 where id=v.id;
 if c.answer_hash is null or extensions.crypt(encode(extensions.digest(lower(trim(answer)),'sha256'),'hex'),c.answer_hash)<>c.answer_hash then return false; end if;
 perform 1 from reports where id in (m.lost_report_id,m.found_report_id) order by id for update;
 if exists(select 1 from reports where id in (m.lost_report_id,m.found_report_id) and status in ('CLAIMED','RETURNED','CLOSED')) then return false; end if;
 update ownership_verifications set status='VERIFIED' where id=v.id;
 update matches set status='VERIFIED' where id=mid;
 update reports set status='CLAIMED',updated_at=now() where id in (m.lost_report_id,m.found_report_id);
 insert into audit_logs(actor_id,action,entity_id) values(actor,'OWNER_VERIFIED',mid);
 insert into messages(match_id,sender_id,message,kind) values(mid,actor,'Ownership verified. You can now arrange a safe handover.','SYSTEM');
 return true;
end $$;
create function public.return_item(mid uuid,actor uuid) returns void language plpgsql set search_path=public as $$
declare m matches; org uuid; begin
 select * into m from matches where id=mid for update;
 select organization_id into org from reports where id=m.found_report_id for update;
 if m.status is distinct from 'VERIFIED' or not (exists(select 1 from staff_members where user_id=actor and organization_id=org) or exists(select 1 from profiles where id=actor and role='PLATFORM_ADMIN')) then raise exception 'Not authorized or invalid transition'; end if;
 if exists(select 1 from reports where id in (m.lost_report_id,m.found_report_id) and status='RETURNED') then raise exception 'Already returned'; end if;
 update reports set status='RETURNED',updated_at=now() where id in (m.lost_report_id,m.found_report_id);
 update matches set status='RETURNED' where id=mid;
 update matches set status='REJECTED' where id<>mid and (lost_report_id=m.lost_report_id or found_report_id=m.found_report_id) and status<>'RETURNED';
 update reports r set status='ACTIVE',updated_at=now()
 where r.id in (select lost_report_id from matches where found_report_id=m.found_report_id and id<>mid)
 and r.type='LOST' and r.status='VERIFYING'
 and not exists(select 1 from matches other where other.lost_report_id=r.id and other.status in ('VERIFYING','VERIFIED','RETURNED'));
 insert into audit_logs(actor_id,action,entity_id) values(actor,'ITEM_RETURNED',mid);
 insert into messages(match_id,sender_id,message,kind) values(mid,actor,'Staff confirmed the item was returned. This conversation is now read-only.','SYSTEM');
end $$;
create function public.claim_job() returns setof jobs language sql set search_path=public as $$
 update jobs set state='RUNNING',locked_at=now(),attempts=attempts+1 where id=(select id from jobs where (state='PENDING' or (state='RUNNING' and locked_at<now()-interval '5 minutes')) and attempts<4 order by created_at for update skip locked limit 1) returning *;
$$;
create function public.nearby_candidates(rid uuid) returns setof reports language sql stable set search_path=public,extensions as $$
 select c.* from reports c join reports r on r.id=rid where c.type<>r.type and c.user_id<>r.user_id and c.category=r.category and c.status in ('ACTIVE','FOUND','STORED','MATCH_FOUND') and abs(extract(epoch from c.event_at-r.event_at))<=604800 and (c.location_id=r.location_id or (c.geo is not null and r.geo is not null and extensions.st_dwithin(c.geo,r.geo,500))) order by c.created_at desc limit 1000;
$$;
-- Functions are not public RPC escape hatches.
revoke execute on function set_challenge(uuid,text,text),publish_report(uuid,uuid),confirm_match(uuid,uuid),verify_ownership(uuid,uuid,text),return_item(uuid,uuid),claim_job(),nearby_candidates(uuid) from public,anon,authenticated;
grant execute on function set_challenge(uuid,text,text),publish_report(uuid,uuid),confirm_match(uuid,uuid),verify_ownership(uuid,uuid,text),return_item(uuid,uuid),claim_job(),nearby_candidates(uuid) to service_role;
alter publication supabase_realtime add table public.messages,public.notifications;

create function public.register_image(rid uuid,actor uuid,path text,thumb text) returns report_images language plpgsql set search_path=public as $$
declare r reports; img report_images; begin
 select * into r from reports where id=rid for update;
 if r.user_id is distinct from actor or r.status<>'DRAFT' or (select count(*) from report_images where report_id=rid)>=5 then raise exception 'Invalid image upload'; end if;
 insert into report_images(report_id,storage_path,thumbnail_path) values(rid,path,thumb) returning * into img;return img;
end $$;
revoke execute on function register_image(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function register_image(uuid,uuid,text,text) to service_role;
create table public.push_deliveries(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references notifications on delete cascade,
 token text not null,state text not null default 'PENDING',attempts integer not null default 0,
 ticket_id text,locked_at timestamptz,next_at timestamptz not null default now(),last_error text,
 unique(notification_id,token)
);
alter table push_deliveries enable row level security;
revoke all on push_deliveries from anon,authenticated;
grant all on push_deliveries to service_role;
create function public.record_match(lid uuid,fid uuid,visual numeric,loc numeric,tm numeric,feature numeric,total numeric) returns void language plpgsql set search_path=public as $$
declare mid uuid; nid uuid; owner_id uuid; item text; begin
 -- Lock both reports so publication, matching and returns cannot race each other.
 perform 1 from reports where id in (lid,fid) order by id for update;
 if not exists(select 1 from reports where id=lid and type='LOST' and status in ('ACTIVE','MATCH_FOUND')) or not exists(select 1 from reports where id=fid and type='FOUND' and status in ('FOUND','STORED','MATCH_FOUND')) then return;end if;
 insert into matches(lost_report_id,found_report_id,visual_score,location_score,time_score,feature_score,total_score) values(lid,fid,visual,loc,tm,feature,total) on conflict do nothing returning id into mid;
 if mid is null then return; end if;
 select user_id into owner_id from reports where id=lid;
 select item_name into item from reports where id=fid;
 insert into notifications(user_id,type,title,message,data) values(owner_id,'MATCH',case when total>=90 then 'Strong match found' else 'Possible match found' end,item||': '||round(total)||'% match',jsonb_build_object('match_id',mid)) returning id into nid;
 if total>=90 then insert into push_deliveries(notification_id,token) select nid,token from push_tokens where user_id=owner_id on conflict do nothing; end if;
 update reports set status='MATCH_FOUND' where id=lid and status='ACTIVE';
end $$;
create function public.claim_push() returns setof push_deliveries language sql set search_path=public as $$
 update push_deliveries set locked_at=now(),attempts=attempts+1,state=case when ticket_id is null then 'SENDING' else 'CHECKING' end
 where id=(select id from push_deliveries where ((state in ('PENDING','RECEIPT') and next_at<=now()) or (state in ('SENDING','CHECKING') and locked_at<now()-interval '2 minutes')) and attempts<8 order by next_at for update skip locked limit 1) returning *;
$$;
revoke execute on function record_match(uuid,uuid,numeric,numeric,numeric,numeric,numeric),claim_push() from public,anon,authenticated;
grant execute on function record_match(uuid,uuid,numeric,numeric,numeric,numeric,numeric),claim_push() to service_role;
create function public.close_report(rid uuid,actor uuid) returns void language plpgsql set search_path=public as $$
declare r reports; begin
 select * into r from reports where id=rid for update;
 if r.user_id is distinct from actor or (r.status in ('VERIFYING','CLAIMED','RETURNED') or exists(select 1 from matches where (lost_report_id=rid or found_report_id=rid) and status in ('VERIFYING','VERIFIED'))) then raise exception 'Report cannot be closed';end if;
 update reports set status='CLOSED',updated_at=now() where id=rid;
 update matches set status='REJECTED' where (lost_report_id=rid or found_report_id=rid) and status in ('PROPOSED','VERIFYING');
 insert into audit_logs(actor_id,action,entity_id) values(actor,'REPORT_CLOSED',rid);
end $$;
revoke execute on function close_report(uuid,uuid) from public,anon,authenticated;
grant execute on function close_report(uuid,uuid) to service_role;
alter table messages add column kind text not null default 'TEXT' check(kind in ('TEXT','IMAGE','SYSTEM'));
alter table messages add column image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chat-images','chat-images',false,10485760,array['image/webp']) on conflict(id) do nothing;
create function public.send_message(mid uuid,actor uuid,body text,path text default null) returns messages language plpgsql set search_path=public as $$
declare m matches; msg messages; begin
 select * into m from matches where id=mid for update;
 if m.status is distinct from 'VERIFIED' then raise exception 'Chat is not open';end if;
 if not exists(select 1 from reports where id in (m.lost_report_id,m.found_report_id) and user_id=actor) and not exists(select 1 from reports r join staff_members sm on sm.organization_id=r.organization_id and sm.user_id=actor where r.id=m.found_report_id) and not exists(select 1 from profiles where id=actor and role='PLATFORM_ADMIN') then raise exception 'Not a participant';end if;
 insert into messages(match_id,sender_id,message,kind,image_path) values(mid,actor,body,case when path is null then 'TEXT' else 'IMAGE' end,path) returning * into msg;return msg;
end $$;
revoke execute on function send_message(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function send_message(uuid,uuid,text,text) to service_role;
alter table reports add column ai_analysis jsonb;
create index jobs_pending on jobs(state,created_at);
create index push_pending on push_deliveries(state,next_at);

COMMIT;
