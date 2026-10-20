-- A student may only change these three columns of their own student_metadata
-- row. id_number is locked at the database level, not just in the UI.
revoke update on public.student_metadata from authenticated;
grant  update (year_level, section, adviser_id) on public.student_metadata to authenticated;

-- KNOWN GAP carried over from Capstone Library (its V8): authenticated still
-- holds the default UPDATE grant on profiles.role and profiles.status. It is
-- harmless only because profiles has no UPDATE policy. Do not add one without
-- restricting columns first. Tightening this is a planned change.
