BEGIN;
alter table public.matches add column if not exists score_version integer not null default 1;
-- Preserve historical values; version 2 stores name/description/color contributions
-- in the existing visual/location/time columns for RPC compatibility.
alter table public.matches drop constraint if exists matches_visual_score_check;
alter table public.matches drop constraint if exists matches_location_score_check;
alter table public.matches drop constraint if exists matches_time_score_check;
alter table public.matches drop constraint if exists matches_feature_score_check;
alter table public.matches add constraint matches_visual_score_check check(visual_score between 0 and 100);
alter table public.matches add constraint matches_location_score_check check(location_score between 0 and 100);
alter table public.matches add constraint matches_time_score_check check(time_score between 0 and 100);
alter table public.matches add constraint matches_feature_score_check check(feature_score between 0 and 100);
create or replace function public.record_match(lid uuid,fid uuid,visual numeric,loc numeric,tm numeric,feature numeric,total numeric) returns void language plpgsql set search_path=public as $$
declare mid uuid; nid uuid; owner_id uuid; item text; begin
 if total<=75 then return;end if;
 -- Lock both reports so publication, matching and returns cannot race each other.
 perform 1 from reports where id in (lid,fid) order by id for update;
 if not exists(select 1 from reports where id=lid and type='LOST' and status in ('ACTIVE','MATCH_FOUND')) or not exists(select 1 from reports where id=fid and type='FOUND' and status in ('FOUND','STORED','MATCH_FOUND')) then return;end if;
 insert into matches(lost_report_id,found_report_id,visual_score,location_score,time_score,feature_score,total_score,score_version) values(lid,fid,visual,loc,tm,feature,total,2) on conflict(lost_report_id,found_report_id) do update set
 status='PROPOSED',rejection_reason=null,score_version=2,visual_score=excluded.visual_score,location_score=excluded.location_score,time_score=excluded.time_score,feature_score=excluded.feature_score,total_score=excluded.total_score
 where matches.status='REJECTED' and matches.rejection_reason='ALGORITHM' returning id into mid;
 if mid is null then return; end if;
 select user_id into owner_id from reports where id=lid;
 select item_name into item from reports where id=fid;
 insert into notifications(user_id,type,title,message,data) values(owner_id,'MATCH',case when total>=90 then 'Strong match found' else 'Possible match found' end,item||': '||round(total,2)||'% match',jsonb_build_object('match_id',mid)) returning id into nid;
 if total>=90 then insert into push_deliveries(notification_id,token) select nid,token from push_tokens where user_id=owner_id on conflict do nothing; end if;
 update reports set status='MATCH_FOUND' where id=lid and status='ACTIVE';
end $$;
insert into public.jobs(report_id) select id from public.reports where status in('ACTIVE','FOUND','STORED','MATCH_FOUND')
 on conflict(report_id) do update set state='PENDING',attempts=0,last_error=null where jobs.state<>'RUNNING';
NOTIFY pgrst,'reload schema';
COMMIT;
