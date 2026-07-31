begin;

create or replace function public.search_expression_groups(
  search_term text default '',
  learning_status_filter text default null,
  favorite_only boolean default false,
  sort_key text default 'latest',
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  normalized_expression text,
  display_expression text,
  representative_expression_id uuid,
  occurrence_count bigint,
  passage_count bigint,
  first_created_at timestamptz,
  latest_created_at timestamptz,
  learning_status text,
  is_favorite boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      e.id,
      e.target_expression,
      e.normalized_expression,
      p.id as active_passage_id,
      e.source_sentence,
      e.created_at
    from public.expressions e
    left join public.passages p
      on p.id = e.passage_id
     and p.user_id = (select auth.uid())
     and p.deleted_at is null
    where e.user_id = (select auth.uid())
      and e.deleted_at is null
      and (
        coalesce(search_term, '') = ''
        or e.target_expression ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
        or e.normalized_expression ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
        or coalesce(e.source_sentence, '') ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
  ),
  grouped as (
    select
      f.normalized_expression,
      count(*) as occurrence_count,
      count(distinct f.active_passage_id) as passage_count,
      min(f.created_at) as first_created_at,
      max(f.created_at) as latest_created_at
    from filtered f
    group by f.normalized_expression
  ),
  represented as (
    select distinct on (f.normalized_expression)
      f.normalized_expression,
      f.target_expression as display_expression,
      f.id as representative_expression_id
    from filtered f
    order by f.normalized_expression, f.created_at desc, f.id desc
  ),
  joined as (
    select
      g.normalized_expression,
      r.display_expression,
      r.representative_expression_id,
      g.occurrence_count,
      g.passage_count,
      g.first_created_at,
      g.latest_created_at,
      coalesce(s.learning_status, 'new') as learning_status,
      coalesce(s.is_favorite, false) as is_favorite
    from grouped g
    join represented r using (normalized_expression)
    left join public.expression_learning_states s
      on s.user_id = (select auth.uid())
     and s.normalized_expression = g.normalized_expression
    where (
        learning_status_filter is null
        or learning_status_filter not in ('new', 'learning', 'known')
        or coalesce(s.learning_status, 'new') = learning_status_filter
      )
      and (
        coalesce(favorite_only, false) is false
        or coalesce(s.is_favorite, false) is true
      )
  )
  select
    j.normalized_expression,
    j.display_expression,
    j.representative_expression_id,
    j.occurrence_count,
    j.passage_count,
    j.first_created_at,
    j.latest_created_at,
    j.learning_status,
    j.is_favorite,
    count(*) over() as total_count
  from joined j
  order by
    case when coalesce(sort_key, 'latest') = 'count' then j.occurrence_count end desc,
    case when coalesce(sort_key, 'latest') = 'latest' or coalesce(sort_key, 'latest') not in ('count', 'latest') then j.latest_created_at end desc,
    j.normalized_expression asc
  limit least(greatest(coalesce(page_limit, 20), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

create or replace function public.list_passages_with_expression_counts(
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  passage_id uuid,
  title text,
  category text,
  distinct_expression_count bigint,
  total_expression_count bigint,
  latest_expression_created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with passage_counts as (
    select
      p.id as passage_id,
      p.title,
      p.category,
      count(distinct e.normalized_expression) as distinct_expression_count,
      count(e.id) as total_expression_count,
      max(e.created_at) as latest_expression_created_at
    from public.passages p
    join public.expressions e
      on e.passage_id = p.id
     and e.user_id = (select auth.uid())
     and e.deleted_at is null
    where p.user_id = (select auth.uid())
      and p.deleted_at is null
    group by p.id, p.title, p.category
  )
  select
    pc.passage_id,
    pc.title,
    pc.category,
    pc.distinct_expression_count,
    pc.total_expression_count,
    pc.latest_expression_created_at,
    count(*) over() as total_count
  from passage_counts pc
  order by pc.latest_expression_created_at desc nulls last, pc.title asc
  limit least(greatest(coalesce(page_limit, 20), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

create or replace function public.search_passage_expression_groups(
  passage_id_value uuid,
  search_term text default '',
  sort_key text default 'latest',
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  normalized_expression text,
  display_expression text,
  representative_expression_id uuid,
  occurrence_count bigint,
  first_created_at timestamptz,
  latest_created_at timestamptz,
  learning_status text,
  is_favorite boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized_passage as (
    select p.id
    from public.passages p
    where p.id = passage_id_value
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ),
  filtered as (
    select
      e.id,
      e.target_expression,
      e.normalized_expression,
      e.source_sentence,
      e.created_at
    from public.expressions e
    join authorized_passage p on p.id = e.passage_id
    where e.user_id = (select auth.uid())
      and e.deleted_at is null
      and (
        coalesce(search_term, '') = ''
        or e.target_expression ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
        or e.normalized_expression ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
        or coalesce(e.source_sentence, '') ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
  ),
  grouped as (
    select
      f.normalized_expression,
      count(*) as occurrence_count,
      min(f.created_at) as first_created_at,
      max(f.created_at) as latest_created_at
    from filtered f
    group by f.normalized_expression
  ),
  represented as (
    select distinct on (f.normalized_expression)
      f.normalized_expression,
      f.target_expression as display_expression,
      f.id as representative_expression_id
    from filtered f
    order by f.normalized_expression, f.created_at desc, f.id desc
  ),
  joined as (
    select
      g.normalized_expression,
      r.display_expression,
      r.representative_expression_id,
      g.occurrence_count,
      g.first_created_at,
      g.latest_created_at,
      coalesce(s.learning_status, 'new') as learning_status,
      coalesce(s.is_favorite, false) as is_favorite
    from grouped g
    join represented r using (normalized_expression)
    left join public.expression_learning_states s
      on s.user_id = (select auth.uid())
     and s.normalized_expression = g.normalized_expression
  )
  select
    j.normalized_expression,
    j.display_expression,
    j.representative_expression_id,
    j.occurrence_count,
    j.first_created_at,
    j.latest_created_at,
    j.learning_status,
    j.is_favorite,
    count(*) over() as total_count
  from joined j
  order by
    case when coalesce(sort_key, 'latest') = 'count' then j.occurrence_count end desc,
    case when coalesce(sort_key, 'latest') = 'latest' or coalesce(sort_key, 'latest') not in ('count', 'latest') then j.latest_created_at end desc,
    j.normalized_expression asc
  limit least(greatest(coalesce(page_limit, 20), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

revoke all on function public.search_expression_groups(text, text, boolean, text, integer, integer) from public;
revoke all on function public.search_expression_groups(text, text, boolean, text, integer, integer) from anon;
grant execute on function public.search_expression_groups(text, text, boolean, text, integer, integer) to authenticated;

revoke all on function public.list_passages_with_expression_counts(integer, integer) from public;
revoke all on function public.list_passages_with_expression_counts(integer, integer) from anon;
grant execute on function public.list_passages_with_expression_counts(integer, integer) to authenticated;

revoke all on function public.search_passage_expression_groups(uuid, text, text, integer, integer) from public;
revoke all on function public.search_passage_expression_groups(uuid, text, text, integer, integer) from anon;
grant execute on function public.search_passage_expression_groups(uuid, text, text, integer, integer) to authenticated;

commit;
