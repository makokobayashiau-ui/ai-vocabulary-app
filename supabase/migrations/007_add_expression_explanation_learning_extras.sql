begin;

alter table public.expression_explanations
add column collocations jsonb,
add column synonyms jsonb,
add column antonyms jsonb;

commit;
