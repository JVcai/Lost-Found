BEGIN;
-- Text overlap is checked in the worker. Location, category and date only rank
-- suggestions and must not discard a possible MVP match before that check.
create or replace function public.nearby_candidates(rid uuid) returns setof public.reports language sql stable set search_path=public as $$
 select c.* from reports c join reports r on r.id=rid
 where c.type<>r.type and c.user_id<>r.user_id
 and c.status in ('ACTIVE','FOUND','STORED','MATCH_FOUND')
 order by c.created_at desc limit 1000;
$$;
-- Re-evaluate existing published items once this migration is applied.
-- Do not interrupt an already leased worker.
insert into public.jobs(report_id)
 select id from public.reports where status in('ACTIVE','FOUND','STORED','MATCH_FOUND')
 on conflict(report_id) do update set state='PENDING',attempts=0,last_error=null
 where jobs.state<>'RUNNING';
NOTIFY pgrst,'reload schema';
COMMIT;
