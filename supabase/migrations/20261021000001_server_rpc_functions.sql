-- Replaces every raw SQL query that used the direct pg connection (Transaction
-- Pooler) with a Postgres function the server calls through supabase-js:
--   admin.rpc("function_name", { ... })
--
-- SECURITY: Supabase grants EXECUTE on new public functions to anon and
-- authenticated by default, and PostgREST exposes them. These functions read
-- across all users (emails, every report), so each one is locked to
-- service_role only. The service role key must stay server side.

-- 1. Scans used today (Manila day). Replaces getRemainingScans in /api/analyze.
create or replace function public.scans_used_today(p_user uuid, p_is_student boolean)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select count(*)::int
  from public.similarity_reports
  where created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
    and case when p_is_student
             then student_id = p_user
             else adviser_id = p_user and student_id is null
        end;
$$;

-- 2. Student dashboard: risk breakdown plus scans used today.
create or replace function public.student_scan_stats(p_student uuid)
returns table (risk_level text, n integer, today integer)
language sql
stable
set search_path to 'public'
as $$
  select r.risk_level,
         count(*)::int,
         (count(*) filter (
            where r.created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
         ))::int
  from public.similarity_reports r
  where r.student_id = p_student
  group by r.risk_level;
$$;

-- 3. Adviser dashboard: per student stats, risk breakdown, and own scans, in one call.
create or replace function public.adviser_scan_stats(p_adviser uuid, p_students uuid[])
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'perStudent', coalesce((
      select jsonb_agg(jsonb_build_object(
               'student_id', x.student_id, 'n', x.n,
               'latest_at', x.latest_at, 'latest_risk', x.latest_risk))
      from (
        select student_id,
               count(*)::int as n,
               max(created_at) as latest_at,
               (array_agg(risk_level order by created_at desc))[1] as latest_risk
        from public.similarity_reports
        where student_id = any(p_students)
        group by student_id
      ) x
    ), '[]'::jsonb),
    'byRisk', coalesce((
      select jsonb_agg(jsonb_build_object('risk_level', y.risk_level, 'n', y.n))
      from (
        select risk_level, count(*)::int as n
        from public.similarity_reports
        where student_id = any(p_students)
        group by risk_level
      ) y
    ), '[]'::jsonb),
    'own', (
      select count(*)::int
      from public.similarity_reports
      where adviser_id = p_adviser and student_id is null
    )
  );
$$;

-- 4. Admin dashboard: risk breakdown and account counts, in one call.
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'risk', coalesce((
      select jsonb_agg(jsonb_build_object('risk_level', x.risk_level, 'n', x.n))
      from (select risk_level, count(*)::int as n from public.similarity_reports group by risk_level) x
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('role', y.role, 'status', y.status, 'n', y.n))
      from (
        select role, status, count(*)::int as n
        from public.profiles
        where role <> 'admin'
        group by role, status
      ) y
    ), '[]'::jsonb)
  );
$$;

-- 5. Registration identity check (public route /api/auth/register/verify-id).
create or replace function public.verify_student_id(p_id text)
returns table (id_number text, full_name text, already_registered boolean)
language sql
stable
set search_path to 'public'
as $$
  select w.id_number, w.full_name, (sm.profile_id is not null)
  from public.student_whitelist w
  left join public.student_metadata sm on sm.id_number = w.id_number
  where w.id_number = p_id;
$$;

-- 6. Admin students tab: search, filter, sort, paginate. Null means "no filter".
create or replace function public.admin_list_students(
  p_q text, p_status text, p_adviser uuid, p_year text, p_section text,
  p_sort text, p_limit integer, p_offset integer
)
returns table (
  profile_id uuid, id_number text, year_level text, section text, adviser_id uuid,
  created_at timestamptz, full_name text, status text, adviser_name text, full_count bigint
)
language sql
stable
set search_path to 'public'
as $$
  select sm.profile_id, sm.id_number, sm.year_level, sm.section, sm.adviser_id,
         sm.created_at, p.full_name, p.status, adv.full_name, count(*) over ()
  from public.student_metadata sm
  join public.profiles p on p.id = sm.profile_id
  left join public.profiles adv on adv.id = sm.adviser_id
  where (p_q is null or p.full_name ilike '%' || p_q || '%')
    and (p_status is null or p.status = p_status)
    and (p_adviser is null or sm.adviser_id = p_adviser)
    and (p_year is null or sm.year_level = p_year)
    and (p_section is null or sm.section = p_section)
  order by case when p_sort = 'name' then p.full_name end asc, sm.created_at desc
  limit p_limit offset p_offset;
$$;

-- 7. Admin advisers tab. SECURITY DEFINER because email lives in auth.users,
-- which the API roles cannot read. Everything is schema qualified and the
-- search path is empty. Only service_role may execute it (see the grants below).
create or replace function public.admin_list_advisers(
  p_q text, p_status text, p_sort text, p_limit integer, p_offset integer
)
returns table (
  id uuid, full_name text, status text, created_at timestamptz, email text, full_count bigint
)
language sql
stable
security definer
set search_path to ''
as $$
  select p.id, p.full_name, p.status, p.created_at, u.email::text, count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'capstone_adviser'
    and p.status in ('active', 'suspended')
    and (p_q is null or p.full_name ilike '%' || p_q || '%')
    and (p_status is null or p.status = p_status)
  order by case when p_sort = 'name' then p.full_name end asc, p.created_at desc
  limit p_limit offset p_offset;
$$;

-- Lock all of them (and match_abstracts, which only the server calls) to service_role.
revoke all on function public.scans_used_today(uuid, boolean)                          from public, anon, authenticated;
revoke all on function public.student_scan_stats(uuid)                                 from public, anon, authenticated;
revoke all on function public.adviser_scan_stats(uuid, uuid[])                         from public, anon, authenticated;
revoke all on function public.admin_dashboard_stats()                                  from public, anon, authenticated;
revoke all on function public.verify_student_id(text)                                  from public, anon, authenticated;
revoke all on function public.admin_list_students(text, text, uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_list_advisers(text, text, text, integer, integer)  from public, anon, authenticated;
revoke all on function public.match_abstracts(vector, double precision, integer)       from public, anon, authenticated;

grant execute on function public.scans_used_today(uuid, boolean)                          to service_role;
grant execute on function public.student_scan_stats(uuid)                                 to service_role;
grant execute on function public.adviser_scan_stats(uuid, uuid[])                         to service_role;
grant execute on function public.admin_dashboard_stats()                                  to service_role;
grant execute on function public.verify_student_id(text)                                  to service_role;
grant execute on function public.admin_list_students(text, text, uuid, text, text, text, integer, integer) to service_role;
grant execute on function public.admin_list_advisers(text, text, text, integer, integer)  to service_role;
grant execute on function public.match_abstracts(vector, double precision, integer)       to service_role;
