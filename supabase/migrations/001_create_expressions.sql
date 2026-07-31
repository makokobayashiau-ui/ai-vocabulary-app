begin;

create type public.learning_status as enum (
  'unreviewed', 'english_reviewed', 'japanese_revealed', 'practicing',
  'understood', 'needs_review', 'mastered'
);

create table public.expressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_expression text not null,
  normalized_expression text not null,
  source_sentence text,
  source_passage text,
  source_title text,
  category text not null default 'other',
  user_memo text,
  learning_status public.learning_status not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint target_expression_not_blank check (char_length(trim(target_expression)) > 0),
  constraint target_expression_length check (char_length(target_expression) <= 300),
  constraint source_sentence_not_blank check (
    source_sentence is null or char_length(trim(source_sentence)) > 0
  ),
  constraint source_sentence_length check (
    source_sentence is null or char_length(source_sentence) <= 5000
  ),
  constraint source_passage_length check (
    source_passage is null or char_length(source_passage) <= 30000
  ),
  constraint expressions_category_allowed check (
    category in (
      'ielts',
      'dmm_eikaiwa',
      'youtube',
      'daily_conversation',
      'nursing',
      'other'
    )
  ),
  constraint source_title_length check (
    source_title is null or char_length(source_title) <= 500
  ),
  constraint user_memo_length check (
    user_memo is null or char_length(user_memo) <= 3000
  )
);

create index expressions_user_created_at_idx on public.expressions (user_id, created_at desc) where deleted_at is null;
create index expressions_user_status_idx on public.expressions (user_id, learning_status) where deleted_at is null;
create index expressions_user_category_idx on public.expressions (user_id, category) where deleted_at is null;
create index expressions_user_normalized_idx on public.expressions (user_id, normalized_expression) where deleted_at is null;

create or replace function public.prepare_expression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.target_expression := trim(new.target_expression);
  new.normalized_expression := lower(regexp_replace(trim(new.target_expression), '\s+', ' ', 'g'));
  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_expression_before_write
before insert or update of target_expression, source_sentence, source_passage, source_title,
  category, user_memo, learning_status, deleted_at
on public.expressions
for each row execute function public.prepare_expression();

alter table public.expressions enable row level security;

create policy "Users can view their own expressions"
on public.expressions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own expressions"
on public.expressions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own expressions"
on public.expressions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.search_expressions(
  search_term text default '',
  category_filter text default null,
  status_filter public.learning_status default null,
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  id uuid, user_id uuid, target_expression text, normalized_expression text,
  source_sentence text, source_passage text, source_title text, category text,
  user_memo text, learning_status public.learning_status, created_at timestamptz,
  updated_at timestamptz, deleted_at timestamptz, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.user_id, e.target_expression, e.normalized_expression,
    e.source_sentence, e.source_passage, e.source_title, e.category,
    e.user_memo, e.learning_status, e.created_at, e.updated_at, e.deleted_at,
    count(*) over() as total_count
  from public.expressions e
  where e.user_id = (select auth.uid())
    and e.deleted_at is null
    and (category_filter is null or e.category = category_filter)
    and (status_filter is null or e.learning_status = status_filter)
    and (
      coalesce(search_term, '') = ''
      or e.target_expression ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      or coalesce(e.source_sentence, '') ilike '%' || replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by e.created_at desc
  limit least(greatest(page_limit, 1), 100)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.search_expressions(
  text,
  text,
  public.learning_status,
  integer,
  integer
) from public;

revoke all on function public.search_expressions(
  text,
  text,
  public.learning_status,
  integer,
  integer
) from anon;

grant execute on function public.search_expressions(
  text,
  text,
  public.learning_status,
  integer,
  integer
) to authenticated;

commit;
