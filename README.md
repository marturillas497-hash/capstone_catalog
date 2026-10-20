# Capstone Library

**Web-Based Capstone Studies with the Integration of Similarity Detection and AI Recommendation**

A capstone system built for the Bachelor of Science in Information Systems (BSIS) program at **Makilala Institute of Science and Technology (MIST)**. It gives students a searchable digital catalog of completed capstone studies and a semantic similarity checker, so a proposed topic can be checked for conceptual overlap against the institution's own capstone library before formal advising — without a trip to the library.

`v1.0.0` · Internal/academic use · Not affiliated with or licensed for use outside MIST's BSIS program.

---

## What it does

- **Digital catalog** of completed BSIS capstone studies (title, authors, year, accession ID, abstract, keywords), searchable and filterable by anyone logged in.
- **Semantic similarity detection** — a proposed title and abstract are converted into a 384-dimension embedding client-side and compared against the library using cosine similarity (pgvector), not keyword matching.
- **AI-generated advisory feedback** (Claude Haiku 5.5) — a verdict, a critical analysis of the overlap, alternative title suggestions, and alternative research directions, grounded only in the institution's own capstone records.
- **Three roles**, each with a dedicated portal: **Student**, **Capstone Adviser**, and **Admin**.

This is a similarity-detection and recommendation tool, **not** a plagiarism checker — it compares conceptual closeness, not manuscript text, and it only ever compares against MIST's own BSIS library.

## Features by role

**Student**
- Browse/search the library, view abstracts, run up to 5 similarity scans/day
- View full scan history and structured AI advisory per report
- Assign/change a capstone adviser; edit year level and section
- Change password, self-service

**Capstone Adviser**
- Everything a student can do on the library + scanning side
- View their explicitly assigned students and each student's report history
- View-only profile summary (name, email, status, assigned student count)

**Admin**
- Manage the capstone library: add/edit abstracts and keywords (no delete)
- Approve/reject adviser registrations (with email notification)
- Manage the student whitelist — CSV bulk upload with a classified preview, or add a single student manually
- View, search, suspend/unsuspend, and reset the password of any student or adviser account
- View analytics: trending abstracts, view history, weekly deltas

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Database | Supabase (PostgreSQL) + pgvector |
| Embeddings | `@xenova/transformers`, `Xenova/all-MiniLM-L6-v2` — runs client-side via WebAssembly |
| Vector search | Direct `pg` connection via Supabase's Transaction Pooler (bypasses PostgREST, which can't pass a JS array as pgvector's `vector` type) |
| AI advisory | Anthropic Claude Haiku 5.5 |
| Auth | Supabase Auth |
| Email | Nodemailer + Gmail SMTP (adviser approval/rejection only) |
| Deployment | Vercel |

### A couple of deliberate architecture choices

- **Embeddings run in the browser**, not on the server. Vercel's serverless functions don't reliably run a WebAssembly ML model, so the model loads once per session (3–8s the first time, instant after) and the resulting vector is sent to the API — the server never runs the model itself.
- **Vector search bypasses Supabase's JS client.** PostgREST can't convert a JS array into pgvector's native `vector` type, so `/api/analyze` and `/api/library/search` connect directly to Postgres with `pg` through the Transaction Pooler instead.
- **No ANN index on the embedding column.** With a small library, a plain sequential scan is faster and more accurate than `ivfflat`. Revisit this only if the library grows into the hundreds of rows.

## Getting started

### Prerequisites

- Node.js (LTS)
- A Supabase project with the `pgvector` extension enabled
- An Anthropic API key
- A Gmail account with an App Password (for adviser approval emails)

### Install

```bash
git clone https://github.com/marturillas497-hash/capstone-library.git
cd capstone-library
npm install
```

### Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_TRANSACTION_POOLER_URL=

ANTHROPIC_API_KEY=

GMAIL_USER=
GMAIL_APP_PASSWORD=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_TRANSACTION_POOLER_URL` are server-side only — never exposed to the client, never prefixed with `NEXT_PUBLIC_`.

### Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Database

The schema, RLS policies, database functions (`match_abstracts`, `get_my_role`), and indexes are documented in full in this project's internal PRD, kept separately from this repo. At a high level:

- `profiles` (parent identity table) → `student_metadata` (child table for student-only fields)
- `abstracts` — the capstone library, with a `vector(384)` embedding column
- `similarity_reports` — one row per scan, including a JSONB snapshot of the matched abstracts
- `abstract_views`, `student_whitelist`
- Every table has RLS enabled; the admin role bypasses via a `SECURITY DEFINER` `get_my_role()` function used across policies

**The admin account is created manually**, not through `/register`:

1. Create the user in Supabase Auth (email + password).
2. Insert one row into `profiles` with that user's UID, `role = admin`, `status = active`. No `student_metadata` row, `terms_accepted_at` left `NULL`.

## Deployment

Deployed on Vercel. The `dev`/`build` scripts intentionally omit any bundler flag — Next.js 15 defaults to Webpack, which is what this project needs (an earlier run on a since-abandoned Next.js 16 upgrade required `--webpack` to avoid Turbopack; that flag has no effect and isn't needed on 15).

## Project structure

```
capstone-library/
├── app/
│   ├── admin/         # Admin portal: dashboard, archive, approvals, analytics, whitelist, users
│   ├── adviser/       # Adviser portal: assigned students, own reports, scan history
│   ├── api/           # API routes (analyze, library search, admin actions, auth)
│   ├── dashboard/     # Student portal
│   ├── library/       # Shared catalog (all roles)
│   ├── submit/        # Similarity scan form (student + adviser)
│   ├── login/ register/ profile/
│   └── layout.js, globals.css
├── components/shared/ # Navbar, modals, PageHeader, ScanProgress, TagInput, etc.
├── lib/               # db.js, risk.js, advisory.js, constants.js, supabase clients
└── middleware.js       # Role-based route protection
```

Key single-source-of-truth files worth knowing about before touching anything nearby:

- `lib/risk.js` — the only place risk-level colors, labels, and thresholds are defined
- `lib/advisory.js` — advisory parsing and per-match risk, imported by every report page
- `lib/constants.js` — `YEAR_LEVELS` / `SECTIONS`, shared by `/profile` and `/admin/users`
- `components/shared/PageHeader.js` — the page-header pattern used on every page

## Roles and routing

| Role | Home | Route access |
|---|---|---|
| Student | `/dashboard` | `/dashboard`, `/library`, `/submit`, `/profile` |
| Capstone Adviser | `/adviser` | `/adviser`, `/library`, `/submit`, `/profile` |
| Admin | `/admin` | `/admin/*`, `/library` (browse/edit only, no scanning) |

## Rate limits

5 similarity scans per user per calendar day, resetting at **12:00 AM Philippine Standard Time (UTC+8)**. Enforced server-side in `/api/analyze`, not just on the client.

## Authors

**Beah Mae F. Dahan** · **Ralph Nico D. Marturillas**
BSIS, College of Technology and Information System, Makilala Institute of Science and Technology

---

Built as a capstone requirement for the BSIS program at MIST, A.Y. 2025–2026. Not licensed for use outside this context.
