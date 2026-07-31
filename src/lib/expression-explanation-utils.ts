import { miniQuizSchema, relatedExpressionSchema } from "@/lib/validation/explanation";
import type { ExpressionExplanation } from "@/types/database";

export function asSafeExpressionExplanation(value: unknown): ExpressionExplanation | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as ExpressionExplanation;
  const quiz = miniQuizSchema.safeParse(raw.mini_quiz);
  const collocations = Array.isArray(raw.collocations)
    ? raw.collocations.filter((item): item is string => typeof item === "string")
    : null;
  const synonyms = Array.isArray(raw.synonyms)
    ? raw.synonyms.map((item) => relatedExpressionSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : null;
  const antonyms = Array.isArray(raw.antonyms)
    ? raw.antonyms.map((item) => relatedExpressionSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : null;

  return {
    ...raw,
    mini_quiz: quiz.success ? quiz.data : null,
    example_sentences: Array.isArray(raw.example_sentences) ? raw.example_sentences.filter((item): item is string => typeof item === "string") : null,
    usage_notes_ja: typeof raw.usage_notes_ja === "string" ? raw.usage_notes_ja : null,
    mnemonic_ja: typeof raw.mnemonic_ja === "string" ? raw.mnemonic_ja : null,
    collocations,
    synonyms,
    antonyms,
  };
}
