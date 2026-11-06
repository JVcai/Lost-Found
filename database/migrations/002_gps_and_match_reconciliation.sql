BEGIN;
alter table public.reports alter column location_id drop not null;
alter table public.reports alter column organization_id drop not null;
alter table public.reports add column if not exists location_label text not null default '';
-- A shared venue must not override two actual GPS positions far apart.
create or replace function public.nearby_candidates(rid uuid) returns setof public.reports language sql stable set search_path=public,extensions as $$
 select c.* from reports c join reports r on r.id=rid
 where c.type<>r.type and c.user_id<>r.user_id and c.category=r.category
 and c.status in ('ACTIVE','FOUND','STORED','MATCH_FOUND')
 and abs(extract(epoch from c.event_at-r.event_at))<=604800
 and (case when c.geo is not null and r.geo is not null then extensions.st_dwithin(c.geo,r.geo,500) else c.location_id is not null and c.location_id=r.location_id end)
 order by c.created_at desc limit 1000;
$$;
create or replace function public.invalidate_match(mid uuid) returns void language plpgsql set search_path=public as $$
declare m matches;begin
 select * into m from matches where id=mid for update;
 if m.status is distinct from 'PROPOSED' then return;end if;
 update matches set status='REJECTED' where id=mid;
 update reports r set status=case when r.type='LOST' then 'ACTIVE' else 'FOUND' end,updated_at=now()
 where r.id in (m.lost_report_id,m.found_report_id) and r.status='MATCH_FOUND'
 and not exists(select 1 from matches x where (x.lost_report_id=r.id or x.found_report_id=r.id) and x.status in ('PROPOSED','VERIFYING','VERIFIED','RETURNED'));
 update notifications set title='Match suggestion withdrawn',message='This suggestion no longer meets the matching criteria.',data=data||'{"invalidated":true}'::jsonb where data->>'match_id'=mid::text;
 update push_deliveries set state='FAILED',last_error='Match invalidated' where notification_id in(select id from notifications where data->>'match_id'=mid::text) and state in ('PENDING','RECEIPT');
end$$;
revoke execute on function invalidate_match(uuid) from public,anon,authenticated;
grant execute on function invalidate_match(uuid) to service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
