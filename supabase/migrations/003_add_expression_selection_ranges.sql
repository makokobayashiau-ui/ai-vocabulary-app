begin;

alter table public.expressions
add column selection_start integer,
add column selection_end integer,
add constraint expressions_selection_range_pair
check (
  (selection_start is null and selection_end is null)
  or (selection_start is not null and selection_end is not null)
),
add constraint expressions_selection_range_valid
check (
  selection_start is null
  or (
    selection_start >= 0
    and selection_end > selection_start
  )
),
add constraint expressions_selection_requires_passage
check (
  selection_start is null
  or passage_id is not null
);

create index expressions_user_passage_selection_idx
on public.expressions (user_id, passage_id, selection_start, selection_end)
where deleted_at is null
  and passage_id is not null
  and selection_start is not null
  and selection_end is not null;

create or replace function public.validate_expression_selection_range()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  passage_content text;
  selected_content text;
begin
  if new.selection_start is null and new.selection_end is null then
    return new;
  end if;

  select p.content
  into passage_content
  from public.passages p
  where p.id = new.passage_id
    and p.user_id = new.user_id
    and p.deleted_at is null;

  if passage_content is null then
    raise exception 'Invalid passage for selection range';
  end if;

  if new.selection_start < 0 or new.selection_end <= new.selection_start then
    raise exception 'Invalid selection range';
  end if;

  -- Selection offsets are stored as Unicode code point offsets.
  -- This intentionally matches PostgreSQL char_length/substring semantics.
  if new.selection_end > char_length(passage_content) then
    raise exception 'Selection range is outside passage content';
  end if;

  selected_content := substring(
    passage_content
    from new.selection_start + 1
    for new.selection_end - new.selection_start
  );

  if selected_content is distinct from new.target_expression then
    raise exception 'Selection range does not match target expression';
  end if;

  return new;
end;
$$;

create trigger validate_expression_selection_range_before_write
before insert or update of selection_start, selection_end, target_expression, passage_id, user_id
on public.expressions
for each row execute function public.validate_expression_selection_range();

revoke all on function public.validate_expression_selection_range() from public;
revoke all on function public.validate_expression_selection_range() from anon;
revoke all on function public.validate_expression_selection_range() from authenticated;

commit;
