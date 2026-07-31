begin;

alter table public.expression_explanations
  add column if not exists collocations jsonb default '[]'::jsonb,
  add column if not exists synonyms jsonb default '[]'::jsonb,
  add column if not exists antonyms jsonb default '[]'::jsonb,
  add column if not exists usage_notes_ja text,
  add column if not exists mnemonic_ja text;

commit;
