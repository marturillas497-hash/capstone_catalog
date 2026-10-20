-- Capstone Catalog: base schema.
-- Mirrors the live Capstone Library schema (inspected read-only, October 20, 2026).
-- pgvector lives in `public`, as it does in Capstone Library, because the app
-- calls match_abstracts($1::vector, ...) and relies on that resolving.

create extension if not exists vector with schema public;

-- Parent identity table. One row per auth user.
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null,
  role              text not null,
  status            text not null default 'active',
  created_at        timestamptz default now(),
  terms_accepted_at timestamptz,
  constraint profiles_role_check   check (role in ('admin', 'capstone_adviser', 'student')),
  constraint profiles_status_check check (status in ('active', 'pending', 'suspended', 'rejected'))
);

-- Child table for student-only fields.
create table public.student_metadata (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  id_number  text not null unique,
  adviser_id uuid references public.profiles (id) on delete set null,
  year_level text,
  section    text,
  created_at timestamptz default now()
);

-- The capstone library.
create table public.abstracts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null unique,
  abstract_text text not null,
  authors       text not null,
  year          integer,
  accession_id  text unique,
  embedding     vector(384),
  created_at    timestamptz default now(),
  keywords      text[] default '{}'
);

-- One row per similarity scan, with a JSONB snapshot of the matches.
create table public.similarity_reports (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid references public.profiles (id),
  adviser_id         uuid references public.profiles (id),
  input_title        text not null,
  input_description  text not null,
  similarity_score   double precision default 0,
  risk_level         text,
  ai_recommendations text,
  results_json       jsonb default '[]'::jsonb,
  created_at         timestamptz default now(),
  constraint similarity_reports_risk_level_check check (risk_level in ('GREEN', 'YELLOW', 'ORANGE', 'RED'))
);

create table public.abstract_views (
  id          uuid primary key default gen_random_uuid(),
  abstract_id uuid not null references public.abstracts (id) on delete cascade,
  viewer_id   uuid references public.profiles (id) on delete set null,
  viewed_at   timestamptz not null default now()
);

-- One view per abstract, viewer and Manila calendar day.
create unique index abstract_views_abstract_viewer_day_expr_unique
  on public.abstract_views (abstract_id, viewer_id, ((timezone('Asia/Manila', viewed_at))::date));

-- Registrar-provided pre-registration list. No foreign keys on purpose.
create table public.student_whitelist (
  id         uuid primary key default gen_random_uuid(),
  id_number  text not null unique,
  full_name  text not null,
  created_at timestamptz not null default now(),
  constraint student_whitelist_id_number_digits check (id_number ~ '^[0-9]+$'),
  constraint student_whitelist_full_name_clean  check (
    full_name = btrim(full_name)
    and full_name !~ '\s{2,}'
    and full_name !~ '[0-9]'
    and char_length(full_name) between 1 and 100
  )
);
