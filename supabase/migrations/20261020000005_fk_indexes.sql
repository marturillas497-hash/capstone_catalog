-- Not in Capstone Library: indexes on foreign keys that dashboards and RLS
-- policies filter by. Without them those filters scan the whole table.
create index similarity_reports_student_id_idx on public.similarity_reports (student_id);
create index similarity_reports_adviser_id_idx on public.similarity_reports (adviser_id);
create index student_metadata_adviser_id_idx   on public.student_metadata (adviser_id);
