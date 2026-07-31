begin;

create table public.expression_learning_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_expression text not null,
  learning_status text not null default 'new',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expression_learning_states_unique_user_normalized
  unique (user_id, normalized_expression),

  constraint expression_learning_states_normalized_not_blank
  check (char_length(trim(normalized_expression)) > 0),

  constraint expression_learning_states_normalized_length
  check (char_length(normalized_expression) <= 300),

  constraint expression_learning_states_status_allowed
  check (learning_status in ('new', 'learning', 'known'))
);

create index expression_learning_states_user_status_idx
on public.expression_learning_states (user_id, learning_status, updated_at desc);

create index expression_learning_states_user_favorite_idx
on public.expression_learning_states (user_id, is_favorite, updated_at desc)
where is_favorite is true;

create or replace function public.prepare_expression_learning_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_expression := public.normalize_expression(new.normalized_expression);
  new.updated_at := now();

  if not exists (
    select 1
    from public.expressions e
    where e.user_id = new.user_id
      and e.deleted_at is null
      and e.normalized_expression = public.normalize_expression(new.normalized_expression)
  ) then
    raise exception 'No expression exists for this normalized expression';
  end if;

  return new;
end;
$$;

create trigger prepare_expression_learning_state_before_write
before insert or update
on public.expression_learning_states
for each row execute function public.prepare_expression_learning_state();

alter table public.expression_learning_states enable row level security;

create policy "Users can view their own expression learning states"
on public.expression_learning_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own expression learning states"
on public.expression_learning_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own expression learning states"
on public.expression_learning_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on function public.prepare_expression_learning_state() from public;
revoke all on function public.prepare_expression_learning_state() from anon;
revoke all on function public.prepare_expression_learning_state() from authenticated;

commit;
