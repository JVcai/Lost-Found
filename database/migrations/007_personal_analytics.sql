BEGIN;
-- Aggregate in PostgreSQL: no API row-limit truncation and no private report data.
create or replace function public.personal_analytics(actor uuid) returns jsonb
language sql stable set search_path=public as $$
 with own as (select type,category,status from reports where user_id=actor),
 totals as (
   select count(*) as total_reports,
     count(*) filter(where status='RETURNED') as returned_reports,
     count(*) filter(where status='DRAFT') as draft_reports
   from own
 ), grouped as (
   select category,count(*) as count from own group by category
 )
 select jsonb_build_object(
   'total_reports',total_reports,
   'returned_reports',returned_reports,
   'draft_reports',draft_reports,
   'return_rate',case when total_reports=0 then 0
     else round(100.0*returned_reports/total_reports,1) end,
   'by_category',coalesce((select jsonb_agg(jsonb_build_object(
     'category',category,'count',count) order by category) from grouped),'[]'::jsonb)
 ) from totals;
$$;
revoke execute on function public.personal_analytics(uuid) from public,anon,authenticated;
grant execute on function public.personal_analytics(uuid) to service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
