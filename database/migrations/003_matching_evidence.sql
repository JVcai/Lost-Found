BEGIN;
alter table public.matches add column if not exists rejection_reason text;
update public.matches m set rejection_reason='ALGORITHM' where status='REJECTED' and rejection_reason is null and exists(select 1 from public.notifications n where n.data->>'match_id'=m.id::text and n.data->>'invalidated'='true');
create or replace function public.invalidate_match(mid uuid) returns void language plpgsql set search_path=public as $$
declare m matches;begin
 select * into m from matches where id=mid for update;
 if m.status is distinct from 'PROPOSED' then return;end if;
 update matches set status='REJECTED',rejection_reason='ALGORITHM' where id=mid;
 update reports r set status=case when r.type='LOST' then 'ACTIVE' else 'FOUND' end,updated_at=now()
 where r.id in (m.lost_report_id,m.found_report_id) and r.status='MATCH_FOUND'
 and not exists(select 1 from matches x where (x.lost_report_id=r.id or x.found_report_id=r.id) and x.status in ('PROPOSED','VERIFYING','VERIFIED','RETURNED'));
 update notifications set title='Match suggestion withdrawn',message='This suggestion no longer meets the matching criteria.',data=data||'{"invalidated":true}'::jsonb where data->>'match_id'=mid::text;
 update push_deliveries set state='FAILED',last_error='Match invalidated' where notification_id in(select id from notifications where data->>'match_id'=mid::text) and state in ('PENDING','RECEIPT');
end$$;
create or replace function public.record_match(lid uuid,fid uuid,visual numeric,loc numeric,tm numeric,feature numeric,total numeric) returns void language plpgsql set search_path=public as $$
declare mid uuid; nid uuid; owner_id uuid; item text; begin
 -- Lock both reports so publication, matching and returns cannot race each other.
 perform 1 from reports where id in (lid,fid) order by id for update;
 if not exists(select 1 from reports where id=lid and type='LOST' and status in ('ACTIVE','MATCH_FOUND')) or not exists(select 1 from reports where id=fid and type='FOUND' and status in ('FOUND','STORED','MATCH_FOUND')) then return;end if;
 insert into matches(lost_report_id,found_report_id,visual_score,location_score,time_score,feature_score,total_score) values(lid,fid,visual,loc,tm,feature,total) on conflict(lost_report_id,found_report_id) do update set
 status='PROPOSED',rejection_reason=null,visual_score=excluded.visual_score,location_score=excluded.location_score,time_score=excluded.time_score,feature_score=excluded.feature_score,total_score=excluded.total_score
 where matches.status='REJECTED' and matches.rejection_reason='ALGORITHM' returning id into mid;
 if mid is null then return; end if;
 select user_id into owner_id from reports where id=lid;
 select item_name into item from reports where id=fid;
 insert into notifications(user_id,type,title,message,data) values(owner_id,'MATCH',case when total>=90 then 'Strong match found' else 'Possible match found' end,item||': '||round(total)||'% match',jsonb_build_object('match_id',mid)) returning id into nid;
 if total>=90 then insert into push_deliveries(notification_id,token) select nid,token from push_tokens where user_id=owner_id on conflict do nothing; end if;
 update reports set status='MATCH_FOUND' where id=lid and status='ACTIVE';
end $$;
NOTIFY pgrst,'reload schema';
COMMIT;
