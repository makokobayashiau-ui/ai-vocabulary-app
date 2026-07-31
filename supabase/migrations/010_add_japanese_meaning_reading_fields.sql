begin;

alter table public.expression_explanations
  add column if not exists japanese_meaning_hiragana text,
  add column if not exists japanese_meaning_romaji text;

commit;
