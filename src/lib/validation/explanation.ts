import { z } from "zod";
import { EXPRESSION_TYPES } from "@/lib/constants";

export const miniQuizSchema = z.object({
  quiz_type: z.enum(["multiple_choice", "fill_in_the_blank"]),
  question: z.string().trim().min(1).max(240),
  options: z.array(z.string().trim().min(1).max(120)).length(4),
  correct_answer_index: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(240),
}).superRefine((value, ctx) => {
  if (!value.options[value.correct_answer_index]?.trim()) {
    ctx.addIssue({ code: "custom", path: ["correct_answer_index"], message: "Correct answer must not be empty." });
  }
});

export const relatedExpressionSchema = z.object({
  expression: z.string().trim().min(1).max(80),
  japanese: z.string().trim().min(1).max(60).nullable(),
});

export const aiExplanationSchema = z.object({
  expression_type: z.enum(EXPRESSION_TYPES),
  simple_english_explanation: z.string().trim().min(1).max(220),
  example_sentences: z.array(z.string().trim().min(1).max(120)).length(3),
  japanese_meaning: z.string().trim().min(1).max(80),
  japanese_meaning_hiragana: z.string().trim().min(1).max(80),
  japanese_meaning_romaji: z.string().trim().min(1).max(120),
  usage_notes: z.string().trim().min(1).max(360),
  usage_notes_ja: z.string().trim().min(1).max(220),
  mnemonic: z.string().trim().min(1).max(220),
  mnemonic_ja: z.string().trim().min(1).max(180),
  mini_quiz: miniQuizSchema,
  collocations: z.array(z.string().trim().min(1).max(80)).max(5),
  synonyms: z.array(relatedExpressionSchema).max(4),
  antonyms: z.array(relatedExpressionSchema).max(3),
});

export type AiExplanationOutput = z.infer<typeof aiExplanationSchema>;
