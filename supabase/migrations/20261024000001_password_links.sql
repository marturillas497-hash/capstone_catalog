-- Set-your-password links: request throttle table plus two service-role-only functions.

create table public.password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index password_reset_requests_user_time_idx
  on public.password_reset_requests (user_id, requested_at desc);

-- Server only: RLS on with no policies, and no direct grants for client roles.
alter table public.password_reset_requests enable row level security;
revoke all on table public.password_reset_requests from anon, authenticated;

-- Who may get a forgot-password link.
--  Student: needs the student ID and the registered email to match.
--  Adviser or staff: email only. Admin is excluded on purpose. Active accounts only.
create or replace function public.find_reset_target(p_email text, p_id_number text)
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path to ''
as $$
  select u.id, p.full_name, u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.student_metadata sm on sm.profile_id = u.id
  where lower(u.email) = lower(p_email)
    and p.status = 'active'
    and (
      (p_id_number is not null and p.role = 'student' and sm.id_number = p_id_number)
      or (p_id_number is null and p.role in ('capstone_adviser', 'staff'))
    )
  limit 1;
$$;

-- Per-account throttle: at most p_max links per hour. Records the request when allowed.
create or replace function public.allow_password_reset(p_user_id uuid, p_max integer default 3)
returns boolean
language plpgsql
set search_path to ''
as $$
declare
  recent integer;
begin
  delete from public.password_reset_requests where requested_at < now() - interval '1 day';

  select count(*) into recent
  from public.password_reset_requests
  where user_id = p_user_id and requested_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.password_reset_requests (user_id) values (p_user_id);
  return true;
end;
$$;

revoke all on function public.find_reset_target(text, text) from public, anon, authenticated;
revoke all on function public.allow_password_reset(uuid, integer) from public, anon, authenticated;
grant execute on function public.find_reset_target(text, text) to service_role;
grant execute on function public.allow_password_reset(uuid, integer) to service_role;
