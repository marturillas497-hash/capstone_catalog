-- Programs, step 1 of multi-program support.
-- Backward compatible on purpose: every new column is nullable and nothing new
-- is enforced yet, so the running app keeps working until step 2 ships the code.
-- Step 2 adds the NOT NULL and CHECK rules (student and adviser need a program,
-- admin and staff must have none).

create table public.programs (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint programs_code_clean check (code ~ '^[A-Za-z]+$')
);

-- Readable before login (the register page lists programs). Writes only through
-- the service role or migrations: no INSERT, UPDATE or DELETE policy exists.
alter table public.programs enable row level security;
create policy programs_select_all on public.programs
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.programs from anon, authenticated;

insert into public.programs (code, name) values
  ('BSIS', 'Bachelor of Science in Information Systems'),
  ('BSC',  'Bachelor of Science in Criminology'),
  ('BSA',  'Bachelor of Science in Agriculture'),
  ('BSM',  'Bachelor of Science in Midwifery'),
  ('BPA',  'Bachelor of Public Administration'),
  ('BSE',  'Bachelor of Science in Entrepreneurship');

-- Program on the parent profile (students and advisers). The whitelist carries
-- it so a student's program comes from the registrar list, never from the form.
-- Programs exist before any whitelist row, so this foreign key does not break
-- the "fill the whitelist before accounts exist" rule.
alter table public.profiles          add column program_id uuid references public.programs (id);
alter table public.student_whitelist add column program_id uuid references public.programs (id);
alter table public.abstracts         add column program_id uuid references public.programs (id);
alter table public.similarity_reports add column program_id uuid references public.programs (id);

-- Everything that exists today is BSIS. Admin and staff stay without a program.
update public.profiles
   set program_id = (select id from public.programs where code = 'BSIS')
 where role in ('student', 'capstone_adviser') and program_id is null;
update public.student_whitelist
   set program_id = (select id from public.programs where code = 'BSIS') where program_id is null;
update public.abstracts
   set program_id = (select id from public.programs where code = 'BSIS') where program_id is null;
update public.similarity_reports
   set program_id = (select id from public.programs where code = 'BSIS') where program_id is null;

create index profiles_program_id_idx           on public.profiles (program_id);
create index student_whitelist_program_id_idx  on public.student_whitelist (program_id);
create index abstracts_program_id_idx          on public.abstracts (program_id);
create index similarity_reports_program_id_idx on public.similarity_reports (program_id);

-- The adviser dropdown filter is only a UI convenience. This is the real rule:
-- a student's adviser must be in the student's program. The profile page writes
-- student_metadata.adviser_id straight from the browser, so it has to live here.
-- Tolerant of nulls for now, because the current code does not set program_id yet.
-- Step 2 tightens it. SECURITY DEFINER so it can read the adviser's profile.
create or replace function public.check_adviser_program()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  student_program uuid;
  adviser_program uuid;
begin
  if new.adviser_id is null then
    return new;
  end if;
  select program_id into student_program from public.profiles where id = new.profile_id;
  select program_id into adviser_program from public.profiles where id = new.adviser_id;
  if student_program is not null and adviser_program is not null
     and student_program <> adviser_program then
    raise exception 'The adviser must belong to the same program as the student.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_adviser_program() from public, anon, authenticated;

create trigger student_metadata_adviser_program
  before insert or update of adviser_id on public.student_metadata
  for each row execute function public.check_adviser_program();

-- Rollback, if ever needed:
--   drop trigger student_metadata_adviser_program on public.student_metadata;
--   drop function public.check_adviser_program();
--   alter table public.profiles, public.student_whitelist, public.abstracts,
--     public.similarity_reports drop column program_id;  (run once per table)
--   drop table public.programs;
