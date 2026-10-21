-- Admin staff page: search, filter, sort, paginate. SECURITY DEFINER because email
-- lives in auth.users. Empty search path, everything schema qualified, and only
-- service_role may execute it.
create or replace function public.admin_list_staff(
  p_q text, p_status text, p_sort text, p_limit integer, p_offset integer
)
returns table (
  id uuid, full_name text, status text, created_at timestamptz, email text,
  abstracts_added integer, full_count bigint
)
language sql
stable
security definer
set search_path to ''
as $$
  select p.id, p.full_name, p.status, p.created_at, u.email::text,
         (select count(*)::int from public.abstracts a where a.added_by = p.id),
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'staff'
    and (p_q is null or p.full_name ilike '%' || p_q || '%')
    and (p_status is null or p.status = p_status)
  order by case when p_sort = 'name' then p.full_name end asc, p.created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.admin_list_staff(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_staff(text, text, text, integer, integer) to service_role;
