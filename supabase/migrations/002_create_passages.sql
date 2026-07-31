begin;

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  source_url text,
  category text not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint passages_title_not_blank check (char_length(trim(title)) > 0),
  constraint passages_title_length check (char_length(title) <= 500),
  constraint passages_content_not_blank check (char_length(trim(content)) > 0),
  constraint passages_content_length check (char_length(content) <= 50000),
  constraint passages_source_url_length check (
    source_url is null or char_length(source_url) <= 2000
  ),
  constraint passages_category_allowed check (
    category in (
      'ielts',
      'nursing',
      'news',
      'youtube',
      'daily_conversation',
      'other'
    )
  )
);

create index passages_user_created_at_idx
on public.passages (user_id, created_at desc)
where deleted_at is null;

create index passages_user_category_idx
on public.passages (user_id, category, created_at desc)
where deleted_at is null;

create or replace function public.prepare_passage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := trim(new.title);
  new.source_url := nullif(trim(coalesce(new.source_url, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_passage_before_write
before insert or update of title, content, source_url, category, deleted_at
on public.passages
for each row execute function public.prepare_passage();

alter table public.passages enable row level security;

create policy "Users can view their own passages"
on public.passages for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own passages"
on public.passages for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own passages"
on public.passages for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.normalize_expression(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(regexp_replace(trim(value), '\s+', ' ', 'g'));
$$;

alter table public.expressions
add column passage_id uuid references public.passages(id) on delete set null;

create index expressions_user_passage_idx
on public.expressions (user_id, passage_id, created_at desc)
where deleted_at is null;

create or replace function public.prepare_expression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.target_expression := trim(new.target_expression);
  new.normalized_expression := public.normalize_expression(new.target_expression);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_expression_passage_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.passage_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.passages p
    where p.id = new.passage_id
      and p.user_id = new.user_id
      and p.deleted_at is null
  ) then
    raise exception 'Invalid passage_id for this user';
  end if;

  return new;
end;
$$;

create trigger validate_expression_passage_owner_before_write
before insert or update of user_id, passage_id
on public.expressions
for each row execute function public.validate_expression_passage_owner();

create or replace function public.count_expression_occurrences(target_value text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.expressions e
  where e.user_id = (select auth.uid())
    and e.deleted_at is null
    and e.normalized_expression = public.normalize_expression(target_value);
$$;

revoke all on function public.normalize_expression(text) from public;
revoke all on function public.normalize_expression(text) from anon;
grant execute on function public.normalize_expression(text) to authenticated;

revoke all on function public.count_expression_occurrences(text) from public;
revoke all on function public.count_expression_occurrences(text) from anon;
grant execute on function public.count_expression_occurrences(text) to authenticated;

commit;
