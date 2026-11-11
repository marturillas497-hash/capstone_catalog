-- Step 2a: the registration identity check also returns the student's program.
-- Additive: the old columns are unchanged, so the code deployed today keeps working.
-- The return type changes, so the function is dropped and recreated.

drop function public.verify_student_id(text);

create function public.verify_student_id(p_id text)
returns table (
  id_number          text,
  full_name          text,
  already_registered boolean,
  program_id         uuid,
  program_code       text,
  program_name       text
)
language sql
stable
set search_path to 'public'
as $$
  select w.id_number, w.full_name, (sm.profile_id is not null),
         w.program_id, p.code, p.name
  from public.student_whitelist w
  left join public.student_metadata sm on sm.id_number = w.id_number
  left join public.programs p on p.id = w.program_id
  where w.id_number = p_id;
$$;

revoke all on function public.verify_student_id(text) from public, anon, authenticated;
grant execute on function public.verify_student_id(text) to service_role;
