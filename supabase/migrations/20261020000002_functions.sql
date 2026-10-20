-- Database functions used by RLS policies and the similarity pipeline.

-- Returns the caller's own role. SECURITY DEFINER so policies on `profiles`
-- can call it without recursing into profiles' own RLS.
create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path to 'public'
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_my_role() from public, anon;
grant  execute on function public.get_my_role() to authenticated;

-- Cosine similarity search over abstracts.
create or replace function public.match_abstracts(
  query_embedding vector,
  match_threshold double precision,
  match_count     integer
)
returns table (
  id            uuid,
  title         text,
  abstract_text text,
  authors       text,
  year          integer,
  accession_id  text,
  keywords      text[],
  similarity    double precision
)
language sql
stable
set search_path to 'public'
as $$
  select
    a.id, a.title, a.abstract_text, a.authors, a.year, a.accession_id, a.keywords,
    1 - (a.embedding <=> query_embedding) as similarity
  from public.abstracts a
  where a.embedding is not null
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
