-- Step 4a: program filters for the admin and staff dashboards and lists.
-- Each function gains a trailing p_program uuid default null (null means all
-- programs). Callers that do not pass it keep working, so the code deployed
-- today is unaffected. The old signatures are dropped because the argument list
-- (and for the two list functions, the return type) changes.

-- Dashboard counts.
drop function public.admin_dashboard_stats();

create function public.admin_dashboard_stats(p_program uuid default null)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'risk', coalesce((
      select jsonb_agg(jsonb_build_object('risk_level', x.risk_level, 'n', x.n))
      from (
        select risk_level, count(*)::int as n
        from public.similarity_reports
        where p_program is null or program_id = p_program
        group by risk_level
      ) x
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('role', y.role, 'status', y.status, 'n', y.n))
      from (
        select role, status, count(*)::int as n
        from public.profiles
        where role <> 'admin'
          and (p_program is null or program_id = p_program)
        group by role, status
      ) y
    ), '[]'::jsonb)
  );
$$;

-- View analytics (staff analytics page). A view belongs to the program of its abstract.
drop function public.view_analytics(timestamptz);

create function public.view_analytics(p_week_start timestamptz, p_program uuid default null)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select jsonb_build_object(
    'total', (
      select count(*) from public.abstract_views v
      join public.abstracts a on a.id = v.abstract_id
      where p_program is null or a.program_id = p_program),
    'week', (
      select count(*) from public.abstract_views v
      join public.abstracts a on a.id = v.abstract_id
      where v.viewed_at >= p_week_start
        and (p_program is null or a.program_id = p_program)),
    'topAll', coalesce((
      select jsonb_agg(t order by t.views desc, t.title)
      from (
        select a.id, a.title, count(*)::int as views
        from public.abstract_views v
        join public.abstracts a on a.id = v.abstract_id
        where p_program is null or a.program_id = p_program
        group by a.id, a.title
        order by views desc, a.title
        limit 10
      ) t), '[]'::jsonb),
    'topWeek', coalesce((
      select jsonb_agg(t order by t.views desc, t.title)
      from (
        select a.id, a.title, count(*)::int as views
        from public.abstract_views v
        join public.abstracts a on a.id = v.abstract_id
        where v.viewed_at >= p_week_start
          and (p_program is null or a.program_id = p_program)
        group by a.id, a.title
        order by views desc, a.title
        limit 5
      ) t), '[]'::jsonb)
  );
$$;

-- Students tab: adds the program filter and returns the program code.
drop function public.admin_list_students(text, text, uuid, text, text, text, integer, integer);

create function public.admin_list_students(
  p_q text, p_status text, p_adviser uuid, p_year text, p_section text,
  p_sort text, p_limit integer, p_offset integer, p_program uuid default null
)
returns table (
  profile_id uuid, id_number text, year_level text, section text, adviser_id uuid,
  created_at timestamptz, full_name text, status text, adviser_name text,
  program_code text, full_count bigint
)
language sql
stable
set search_path to 'public'
as $$
  select sm.profile_id, sm.id_number, sm.year_level, sm.section, sm.adviser_id,
         sm.created_at, p.full_name, p.status, adv.full_name, pr.code, count(*) over ()
  from public.student_metadata sm
  join public.profiles p on p.id = sm.profile_id
  left join public.profiles adv on adv.id = sm.adviser_id
  left join public.programs pr on pr.id = p.program_id
  where (p_q is null or p.full_name ilike '%' || p_q || '%')
    and (p_status is null or p.status = p_status)
    and (p_adviser is null or sm.adviser_id = p_adviser)
    and (p_year is null or sm.year_level = p_year)
    and (p_section is null or sm.section = p_section)
    and (p_program is null or p.program_id = p_program)
  order by case when p_sort = 'name' then p.full_name end asc, sm.created_at desc
  limit p_limit offset p_offset;
$$;

-- Advisers tab. SECURITY DEFINER because email lives in auth.users.
drop function public.admin_list_advisers(text, text, text, integer, integer);

create function public.admin_list_advisers(
  p_q text, p_status text, p_sort text, p_limit integer, p_offset integer,
  p_program uuid default null
)
returns table (
  id uuid, full_name text, status text, created_at timestamptz, email text,
  program_code text, full_count bigint
)
language sql
stable
security definer
set search_path to ''
as $$
  select p.id, p.full_name, p.status, p.created_at, u.email::text, pr.code, count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.programs pr on pr.id = p.program_id
  where p.role = 'capstone_adviser'
    and p.status in ('active', 'suspended')
    and (p_q is null or p.full_name ilike '%' || p_q || '%')
    and (p_status is null or p.status = p_status)
    and (p_program is null or p.program_id = p_program)
  order by case when p_sort = 'name' then p.full_name end asc, p.created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.admin_dashboard_stats(uuid) from public, anon, authenticated;
revoke all on function public.view_analytics(timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_students(text, text, uuid, text, text, text, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_advisers(text, text, text, integer, integer, uuid) from public, anon, authenticated;

grant execute on function public.admin_dashboard_stats(uuid) to service_role;
grant execute on function public.view_analytics(timestamptz, uuid) to service_role;
grant execute on function public.admin_list_students(text, text, uuid, text, text, text, integer, integer, uuid) to service_role;
grant execute on function public.admin_list_advisers(text, text, text, integer, integer, uuid) to service_role;
