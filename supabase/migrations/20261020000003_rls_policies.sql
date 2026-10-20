-- Row level security. Enabled on every table.
-- Mirrors the live Capstone Library policies, not the older PRD v1.11 list.
-- Note: there is deliberately NO insert policy on similarity_reports and none
-- of any kind for writes on profiles. Those writes go through the service role.

alter table public.profiles           enable row level security;
alter table public.student_metadata   enable row level security;
alter table public.abstracts          enable row level security;
alter table public.similarity_reports enable row level security;
alter table public.abstract_views     enable row level security;
alter table public.student_whitelist  enable row level security;

-- profiles
create policy profiles_select_scoped on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select get_my_role()) = 'admin'
    or (role = 'capstone_adviser' and status = 'active')
    or exists (select 1 from public.student_metadata sm
               where sm.profile_id = profiles.id and sm.adviser_id = (select auth.uid()))
    or exists (select 1 from public.student_metadata sm
               where sm.adviser_id = profiles.id and sm.profile_id = (select auth.uid()))
  );

-- Active advisers are visible before login, for the register page dropdown.
create policy profiles_select_anon_advisers on public.profiles
  for select to anon
  using (role = 'capstone_adviser' and status = 'active');

-- student_metadata
create policy student_metadata_select_scoped on public.student_metadata
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or adviser_id = (select auth.uid())
    or (select get_my_role()) = 'admin'
  );

create policy student_metadata_update_own on public.student_metadata
  for update to authenticated
  using (profile_id = auth.uid());

-- abstracts
create policy abstracts_select_authenticated on public.abstracts
  for select to authenticated using (true);

create policy abstracts_insert_admin on public.abstracts
  for insert to authenticated with check (get_my_role() = 'admin');

create policy abstracts_update_admin on public.abstracts
  for update to authenticated using (get_my_role() = 'admin');

-- similarity_reports
create policy reports_select_own on public.similarity_reports
  for select to authenticated using (student_id = auth.uid());

create policy reports_select_adviser on public.similarity_reports
  for select to authenticated using (adviser_id = auth.uid());

create policy reports_select_admin on public.similarity_reports
  for select to authenticated using (get_my_role() = 'admin');

-- abstract_views
create policy views_insert_student on public.abstract_views
  for insert to authenticated
  with check (get_my_role() = 'student' and viewer_id = auth.uid());

create policy views_select_admin on public.abstract_views
  for select to authenticated using (get_my_role() = 'admin');

-- student_whitelist
create policy whitelist_all_admin on public.student_whitelist
  for all to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');
