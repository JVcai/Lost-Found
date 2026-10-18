BEGIN;
alter table public.matches add column if not exists source text not null default 'AUTOMATIC';
create or replace function public.request_claim(lid uuid,fid uuid,actor uuid) returns uuid language plpgsql set search_path=public as $$
declare l reports; f reports; m matches; mid uuid; begin
 perform 1 from reports where id in(lid,fid) order by id for update;
 select * into l from reports where id=lid;
 select * into f from reports where id=fid;
 if l.user_id is distinct from actor or l.type is distinct from 'LOST' or l.status not in('ACTIVE','MATCH_FOUND') then raise exception 'Select your active lost report';end if;
 if f.type is distinct from 'FOUND' or f.user_id=actor or f.status not in('FOUND','STORED','MATCH_FOUND') then raise exception 'Found report is not available';end if;
 select * into m from matches where lost_report_id=lid and found_report_id=fid for update;
 if m.id is not null then
   if m.status='REJECTED' and m.rejection_reason is distinct from 'ALGORITHM' then raise exception 'This pair was rejected';end if;
   if m.status<>'REJECTED' then return m.id;end if;
   update matches set status='PROPOSED',source='MANUAL',rejection_reason=null where id=m.id;
   mid:=m.id;
 end if;
 if mid is null then
 insert into matches(lost_report_id,found_report_id,visual_score,location_score,time_score,feature_score,total_score,source) values(lid,fid,0,0,0,0,0,'MANUAL') returning id into mid;
 end if;
 update reports set status='MATCH_FOUND',updated_at=now() where id=lid;
 insert into notifications(user_id,type,title,message,data) values(f.user_id,'MATCH','Ownership claim requested','Someone recognized your found item. Ownership has not been verified.',jsonb_build_object('match_id',mid));
 insert into audit_logs(actor_id,action,entity_id) values(actor,'MANUAL_CLAIM_REQUESTED',mid);
 return mid;
end$$;
revoke execute on function request_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function request_claim(uuid,uuid,uuid) to service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
