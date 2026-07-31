begin;

alter table public.expression_explanations
add column usage_notes_ja text,
add column mnemonic_ja text;

commit;
