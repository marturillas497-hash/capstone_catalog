-- Step 2b: enforce the program rules.
-- APPLY ONLY AFTER the step 2 code is deployed. The code deployed before it
-- inserts profiles without a program, and these rules would reject that.

-- Students and advisers must have a program. Admin and staff must not.
alter table public.profiles add constraint profiles_program_by_role check (
  (role in ('student', 'capstone_adviser') and program_id is not null)
  or (role in ('admin', 'staff') and program_id is null)
);

-- Tightens the step 1 trigger. When the adviser is set or changed, they must be
-- an active capstone adviser in the same program as the student. Saves that
-- resend the same adviser_id (the profile page does this on every save) are not
-- re-checked, so a student whose adviser was suspended later can still save.
create or replace function public.check_adviser_program()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  student_program uuid;
  adviser_row     record;
begin
  if new.adviser_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.adviser_id is not distinct from old.adviser_id then
      return new;
    end if;
  end if;

  select program_id into student_program
    from public.profiles where id = new.profile_id;
  select role, status, program_id into adviser_row
    from public.profiles where id = new.adviser_id;

  if adviser_row.role is distinct from 'capstone_adviser'
     or adviser_row.status is distinct from 'active' then
    raise exception 'The selected adviser is not available.' using errcode = '23514';
  end if;

  if student_program is distinct from adviser_row.program_id then
    raise exception 'The adviser must belong to the same program as the student.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Rollback:
--   alter table public.profiles drop constraint profiles_program_by_role;
--   then restore the step 1 trigger function from 20261110000001_programs.sql.
