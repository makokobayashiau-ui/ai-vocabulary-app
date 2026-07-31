begin;

create table public.expression_explanations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_expression text not null,
  display_expression text not null,

  expression_type text,
  simple_english_explanation text,
  example_sentences jsonb,
  japanese_meaning text,
  usage_notes text,
  mnemonic text,
  mini_quiz jsonb,

  generation_status text not null default 'pending',
  error_message text,
  model text,
  prompt_version text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expression_explanations_unique_user_normalized
  unique (user_id, normalized_expression),

  constraint expression_explanations_normalized_not_blank
  check (char_length(trim(normalized_expression)) > 0),

  constraint expression_explanations_normalized_length
  check (char_length(normalized_expression) <= 300),

  constraint expression_explanations_display_not_blank
  check (char_length(trim(display_expression)) > 0),

  constraint expression_explanations_display_length
  check (char_length(display_expression) <= 300),

  constraint expression_explanations_expression_type_allowed
  check (
    expression_type is null
    or expression_type in (
      'word',
      'noun',
      'verb',
      'adjective',
      'adverb',
      'auxiliary_verb',
      'phrasal_verb',
      'idiom',
      'collocation',
      'noun_phrase',
      'fixed_expression',
      'other'
    )
  ),

  constraint expression_explanations_generation_status_allowed
  check (generation_status in ('pending', 'completed', 'failed')),

  constraint expression_explanations_completed_required_fields
  check (
    generation_status <> 'completed'
    or (
      expression_type is not null
      and simple_english_explanation is not null
      and char_length(trim(simple_english_explanation)) > 0
      and example_sentences is not null
      and jsonb_typeof(example_sentences) = 'array'
      and jsonb_array_length(example_sentences) = 3
      and japanese_meaning is not null
      and char_length(trim(japanese_meaning)) > 0
      and usage_notes is not null
      and char_length(trim(usage_notes)) > 0
      and mnemonic is not null
      and char_length(trim(mnemonic)) > 0
      and mini_quiz is not null
      and jsonb_typeof(mini_quiz) = 'object'
      and generated_at is not null
    )
  ),

  constraint expression_explanations_pending_generated_at_null
  check (
    generation_status <> 'pending'
    or generated_at is null
  ),

  constraint expression_explanations_mini_quiz_shape
  check (
    mini_quiz is null
    or (
      jsonb_typeof(mini_quiz) = 'object'
      and mini_quiz ? 'quiz_type'
      and mini_quiz ? 'question'
      and mini_quiz ? 'options'
      and mini_quiz ? 'correct_answer_index'
      and mini_quiz ? 'explanation'
      and mini_quiz->>'quiz_type' in ('multiple_choice', 'fill_in_the_blank')
      and jsonb_typeof(mini_quiz->'options') = 'array'
      and jsonb_array_length(mini_quiz->'options') = 4
      and jsonb_typeof(mini_quiz->'correct_answer_index') = 'number'
      and (mini_quiz->>'correct_answer_index') in ('0', '1', '2', '3')
    )
  ),

  constraint expression_explanations_simple_english_length
  check (
    simple_english_explanation is null
    or char_length(simple_english_explanation) <= 1000
  ),

  constraint expression_explanations_japanese_meaning_length
  check (
    japanese_meaning is null
    or char_length(japanese_meaning) <= 100
  ),

  constraint expression_explanations_usage_notes_length
  check (
    usage_notes is null
    or char_length(usage_notes) <= 1000
  ),

  constraint expression_explanations_mnemonic_length
  check (
    mnemonic is null
    or char_length(mnemonic) <= 500
  ),

  constraint expression_explanations_error_message_length
  check (
    error_message is null
    or char_length(error_message) <= 1000
  ),

  constraint expression_explanations_model_length
  check (
    model is null
    or char_length(model) <= 100
  ),

  constraint expression_explanations_prompt_version_length
  check (
    prompt_version is null
    or char_length(prompt_version) <= 100
  )
);

create index expression_explanations_user_status_idx
on public.expression_explanations (user_id, generation_status, updated_at desc);

create or replace function public.prepare_expression_explanation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_expression := public.normalize_expression(new.normalized_expression);
  new.display_expression := trim(new.display_expression);

  new.expression_type := nullif(trim(coalesce(new.expression_type, '')), '');
  new.simple_english_explanation := nullif(trim(coalesce(new.simple_english_explanation, '')), '');
  new.japanese_meaning := nullif(trim(coalesce(new.japanese_meaning, '')), '');
  new.usage_notes := nullif(trim(coalesce(new.usage_notes, '')), '');
  new.mnemonic := nullif(trim(coalesce(new.mnemonic, '')), '');
  new.error_message := nullif(trim(coalesce(new.error_message, '')), '');
  new.model := nullif(trim(coalesce(new.model, '')), '');
  new.prompt_version := nullif(trim(coalesce(new.prompt_version, '')), '');

  new.updated_at := now();

  if new.generation_status = 'completed' and new.generated_at is null then
    new.generated_at := now();
  end if;

  if new.generation_status = 'completed' then
    new.error_message := null;
  end if;

  if new.generation_status in ('pending', 'failed') then
    new.expression_type := null;
    new.simple_english_explanation := null;
    new.example_sentences := null;
    new.japanese_meaning := null;
    new.usage_notes := null;
    new.mnemonic := null;
    new.mini_quiz := null;
    new.generated_at := null;
  end if;

  if new.generation_status = 'pending' then
    new.error_message := null;
  end if;

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

create trigger prepare_expression_explanation_before_write
before insert or update
on public.expression_explanations
for each row execute function public.prepare_expression_explanation();

alter table public.expression_explanations enable row level security;

create policy "Users can view their own expression explanations"
on public.expression_explanations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own expression explanations"
on public.expression_explanations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own expression explanations"
on public.expression_explanations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on function public.prepare_expression_explanation() from public;
revoke all on function public.prepare_expression_explanation() from anon;
revoke all on function public.prepare_expression_explanation() from authenticated;

commit;
