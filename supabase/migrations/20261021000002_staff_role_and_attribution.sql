-- Staff role and abstract attribution.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'capstone_adviser', 'student', 'staff'));

-- added_by is set by the server from the session, never from a request body.
-- Rows that existed before staff accounts have a null added_by and are shown as "Admin".
alter table public.abstracts
  add column added_by   uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz;

-- Serves the per-staff lists and the monthly counts.
create index abstracts_added_by_created_idx on public.abstracts (added_by, created_at desc);
