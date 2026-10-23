-- Admin library: who has added abstracts, with counts. Service role only.
-- Not SECURITY DEFINER: the service role bypasses RLS, so no elevated rights are needed.
create or replace function public.abstract_adders()
returns table (id uuid, full_name text, role text, abstracts_added integer)
language sql
stable
set search_path to ''
as $$
  select p.id, p.full_name, p.role, count(*)::int
  from public.abstracts a
  join public.profiles p on p.id = a.added_by
  group by p.id, p.full_name, p.role
  order by p.full_name;
$$;

revoke all on function public.abstract_adders() from public, anon, authenticated;
grant execute on function public.abstract_adders() to service_role;
