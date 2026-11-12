-- Step 3b: make the program required on abstracts, whitelist rows and reports,
-- and retire the old three-argument match_abstracts.
-- APPLY ONLY AFTER the step 3 code is deployed (and after 20261110000003).
-- Code deployed before it inserts these rows without a program.

-- Rows the older code created since step 1 have no program. Until other programs
-- hold real data, everything missing one is BSIS.
update public.abstracts
   set program_id = (select id from public.programs where code = 'BSIS')
 where program_id is null;
update public.student_whitelist
   set program_id = (select id from public.programs where code = 'BSIS')
 where program_id is null;
update public.similarity_reports r
   set program_id = coalesce(
     (select p.program_id from public.profiles p where p.id = coalesce(r.student_id, r.adviser_id)),
     (select id from public.programs where code = 'BSIS'))
 where r.program_id is null;

alter table public.abstracts          alter column program_id set not null;
alter table public.student_whitelist  alter column program_id set not null;
alter table public.similarity_reports alter column program_id set not null;

drop function public.match_abstracts(vector, double precision, integer);

-- Rollback:
--   alter table public.abstracts, ... alter column program_id drop not null;  (per table)
--   recreate the three-argument function from 20261020000002_functions.sql and
--   20261021000001_server_rpc_functions.sql (service_role only).
