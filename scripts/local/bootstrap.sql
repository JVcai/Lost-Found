create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
-- Only a fresh fixture may rebuild the image's default PostGIS installation.
-- No CASCADE: an unexpected dependency prevents changes rather than dropping data.
do $$begin
 if to_regclass('public.reports') is null and exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname<>'extensions') then
  drop extension if exists postgis_topology;
  drop extension if exists postgis_raster;
  drop extension postgis;
 end if;
end$$;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit;end if;end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='supabase_storage_admin') then create role supabase_storage_admin login superuser;end if;end$$;
do $$begin if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login superuser;end if;end$$;
grant anon,authenticated,service_role to authenticator;
grant usage on schema public,auth,extensions to anon,authenticated,service_role;
create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
create or replace function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))::text$$;
do $$begin if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime;end if;end$$;

alter role postgres set search_path=storage,public,extensions;
