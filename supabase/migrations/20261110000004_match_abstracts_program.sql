-- Step 3a: program-aware similarity search.
-- A new four-argument overload. The old three-argument function is left in place
-- so the code deployed today keeps working; step 3b drops it after the deploy.
-- p_program null searches every program (library browsing). A scan passes the
-- user's own program. There is deliberately no default, so a three-argument call
-- always resolves to the old function.

create function public.match_abstracts(
  query_embedding vector,
  match_threshold double precision,
  match_count     integer,
  p_program       uuid
)
returns table (
  id            uuid,
  title         text,
  abstract_text text,
  authors       text,
  year          integer,
  accession_id  text,
  keywords      text[],
  program_id    uuid,
  similarity    double precision
)
language sql
stable
set search_path to 'public'
as $$
  select
    a.id, a.title, a.abstract_text, a.authors, a.year, a.accession_id, a.keywords,
    a.program_id,
    1 - (a.embedding <=> query_embedding) as similarity
  from public.abstracts a
  where a.embedding is not null
    and (p_program is null or a.program_id = p_program)
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_abstracts(vector, double precision, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.match_abstracts(vector, double precision, integer, uuid)
  to service_role;
