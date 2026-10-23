-- Admin staff page: abstracts added per staff member, this month and all time.
-- p_month_start is the Manila month start, computed by the caller. Aggregates only.
create or replace function public.staff_contribution_stats(p_month_start timestamptz)
returns table (id uuid, full_name text, month_count integer, total_count integer)
language sql
stable
set search_path to ''
as $$
  select p.id, p.full_name,
         (count(*) filter (where a.created_at >= p_month_start))::int as month_count,
         count(*)::int as total_count
  from public.abstracts a
  join public.profiles p on p.id = a.added_by
  where p.role = 'staff'
  group by p.id, p.full_name
  order by month_count desc, total_count desc, p.full_name;
$$;

revoke all on function public.staff_contribution_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.staff_contribution_stats(timestamptz) to service_role;
