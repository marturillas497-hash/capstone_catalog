-- Library-wide view analytics as aggregates only: totals plus top abstracts. No viewer data.
-- One round trip, GROUP BY in Postgres. Service role only.
create index if not exists abstract_views_viewed_at_idx on public.abstract_views (viewed_at);

create or replace function public.view_analytics(p_week_start timestamptz)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.abstract_views),
    'week',  (select count(*) from public.abstract_views where viewed_at >= p_week_start),
    'topAll', coalesce((
      select jsonb_agg(t order by t.views desc, t.title)
      from (
        select a.id, a.title, count(*)::int as views
        from public.abstract_views v
        join public.abstracts a on a.id = v.abstract_id
        group by a.id, a.title
        order by views desc, a.title
        limit 10
      ) t), '[]'::jsonb),
    'topWeek', coalesce((
      select jsonb_agg(t order by t.views desc, t.title)
      from (
        select a.id, a.title, count(*)::int as views
        from public.abstract_views v
        join public.abstracts a on a.id = v.abstract_id
        where v.viewed_at >= p_week_start
        group by a.id, a.title
        order by views desc, a.title
        limit 5
      ) t), '[]'::jsonb)
  );
$$;

revoke all on function public.view_analytics(timestamptz) from public, anon, authenticated;
grant execute on function public.view_analytics(timestamptz) to service_role;
