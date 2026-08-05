"use server";

import OpenAI from "openai";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { passageIdSchema } from "@/lib/validation/passage";

const DEFAULT_MODEL = "gpt-4.1-mini";

const focusPointSchema = z.object({
  expression: z.string().trim().min(1).max(120),
  hint_english: z.string().trim().min(1).max(180),
  hint_japanese: z.string().trim().min(1).max(160).nullable(),
});

const challengeSchema = z.object({
  sentence: z.string().trim().min(10).max(500),
  reason: z.string().trim().min(1).max(220),
  focus_points: z.array(focusPointSchema).min(3).max(6),
});

const firstReviewSchema = z.object({
  summary: z.enum(["Almost there.", "Good start.", "Needs another look."]),
  misunderstood_expressions: z.array(z.string().trim().min(1).max(120)).max(6),
  guidance: z.string().trim().min(1).max(260),
});

const finalPointSchema = z.object({
  expression: z.string().trim().min(1).max(120),
  status: z.enum(["understood", "partly_understood", "needs_review"]),
  feedback: z.string().trim().min(1).max(220),
  save_for_review: z.boolean(),
});

const finalReviewSchema = z.object({
  suggested_translation: z.string().trim().min(1).max(700),
  important_points: z.array(finalPointSchema).min(3).max(8),
  meaning_score: z.enum(["Excellent", "Good", "Needs another look"]),
  grammar_score: z.enum(["Excellent", "Good", "Needs another look"]),
  expressions_understood: z.object({
    understood: z.number().int().min(0).max(8),
    total: z.number().int().min(1).max(8),
  }),
  overall: z.string().trim().min(1).max(260),
});

export type SentenceChallenge = z.infer<typeof challengeSchema>;
export type SentenceChallengeFocusPoint = z.infer<typeof focusPointSchema>;
export type FirstSentenceReview = z.infer<typeof firstReviewSchema>;
export type FinalSentenceReview = z.infer<typeof finalReviewSchema> & { savedExpressions: number };

export type SentenceChallengeResult<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function modelName() {
  return process.env.OPENAI_EXPLANATION_MODEL?.trim() || DEFAULT_MODEL;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function structuredResponse<T>(schema: Record<string, unknown>, input: string, parser: z.ZodType<T>): Promise<T> {
  const client = openaiClient();
  if (!client) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await client.responses.create({
    model: modelName(),
    input,
    text: {
      format: {
        type: "json_schema",
        name: "sentence_challenge",
        strict: true,
        schema,
      },
    },
  });
  if (!response.output_text) throw new Error("AI returned no text.");
  const parsed = parser.safeParse(JSON.parse(response.output_text) as unknown);
  if (!parsed.success) {
    console.error("Sentence Challenge AI output failed validation", { issues: parsed.error.issues });
    throw new Error("AI response was not valid.");
  }
  return parsed.data;
}

async function loadPassage(passageId: string) {
  if (!passageIdSchema.safeParse(passageId).success) return { error: "Passage not found." as const };
  const { supabase, user } = await authenticatedClient();
  const { data: passage, error } = await supabase.from("passages")
    .select("id,title,content,category")
    .eq("id", passageId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("Sentence Challenge passage load failed", { code: error.code, message: error.message });
    return { error: "Could not load this passage." as const };
  }
  if (!passage) return { error: "Passage not found." as const };
  return { supabase, user, passage };
}

const challengeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sentence", "reason", "focus_points"],
  properties: {
    sentence: { type: "string", minLength: 10, maxLength: 500 },
    reason: { type: "string", minLength: 1, maxLength: 220 },
    focus_points: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expression", "hint_english", "hint_japanese"],
        properties: {
          expression: { type: "string", minLength: 1, maxLength: 120 },
          hint_english: { type: "string", minLength: 1, maxLength: 180 },
          hint_japanese: { type: ["string", "null"], maxLength: 160 },
        },
      },
    },
  },
} as const;

const firstReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "misunderstood_expressions", "guidance"],
  properties: {
    summary: { type: "string", enum: ["Almost there.", "Good start.", "Needs another look."] },
    misunderstood_expressions: { type: "array", minItems: 0, maxItems: 6, items: { type: "string", minLength: 1, maxLength: 120 } },
    guidance: { type: "string", minLength: 1, maxLength: 260 },
  },
} as const;

const finalReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggested_translation", "important_points", "meaning_score", "grammar_score", "expressions_understood", "overall"],
  properties: {
    suggested_translation: { type: "string", minLength: 1, maxLength: 700 },
    important_points: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expression", "status", "feedback", "save_for_review"],
        properties: {
          expression: { type: "string", minLength: 1, maxLength: 120 },
          status: { type: "string", enum: ["understood", "partly_understood", "needs_review"] },
          feedback: { type: "string", minLength: 1, maxLength: 220 },
          save_for_review: { type: "boolean" },
        },
      },
    },
    meaning_score: { type: "string", enum: ["Excellent", "Good", "Needs another look"] },
    grammar_score: { type: "string", enum: ["Excellent", "Good", "Needs another look"] },
    expressions_understood: {
      type: "object",
      additionalProperties: false,
      required: ["understood", "total"],
      properties: {
        understood: { type: "integer", minimum: 0, maximum: 8 },
        total: { type: "integer", minimum: 1, maximum: 8 },
      },
    },
    overall: { type: "string", minLength: 1, maxLength: 260 },
  },
} as const;

export async function createSentenceChallenge(passageId: string): Promise<SentenceChallengeResult<SentenceChallenge>> {
  const loaded = await loadPassage(passageId);
  if ("error" in loaded) return { error: loaded.error };

  try {
    const data = await structuredResponse(
      challengeJsonSchema,
      [
        "You are a personal English tutor.",
        "Select one important sentence from this passage for a sentence translation challenge.",
        "Selection criteria: important for understanding the passage, useful IELTS vocabulary or grammar, around 20-35 words, not too easy, not random.",
        "Then choose 3 to 6 focus points. Hints must guide the learner, not give the full answer.",
        "Write hint_english in simple CEFR A2-B1 English. hint_japanese may be a short Japanese support note.",
        "",
        `Passage title: ${loaded.passage.title}`,
        `Passage category: ${loaded.passage.category}`,
        "Passage:",
        loaded.passage.content,
      ].join("\n"),
      challengeSchema,
    );
    return { success: true, data };
  } catch (error) {
    console.error("Sentence Challenge creation failed", { message: errorMessage(error) });
    return { error: "Could not create a sentence challenge. Please try again." };
  }
}

export async function reviewFirstSentenceTranslation(
  passageId: string,
  sentence: string,
  focusPoints: SentenceChallengeFocusPoint[],
  firstAnswer: string,
): Promise<SentenceChallengeResult<FirstSentenceReview>> {
  const loaded = await loadPassage(passageId);
  if ("error" in loaded) return { error: loaded.error };
  if (!firstAnswer.trim()) return { error: "Please write your translation first." };

  try {
    const data = await structuredResponse(
      firstReviewJsonSchema,
      [
        "You are a kind English tutor.",
        "Review the learner's Japanese translation for understanding, not exact wording.",
        "Do not show a model answer yet. Do not explain the exact meanings yet.",
        "Point out only the important parts to think about again.",
        "Never say 'wrong'. Use gentle language.",
        "",
        `Sentence: ${sentence}`,
        `Focus points: ${JSON.stringify(focusPoints)}`,
        `Learner translation: ${firstAnswer}`,
      ].join("\n"),
      firstReviewSchema,
    );
    return { success: true, data };
  } catch (error) {
    console.error("Sentence Challenge first review failed", { message: errorMessage(error) });
    return { error: "Could not check your translation. Please try again." };
  }
}

export async function reviewFinalSentenceTranslation(
  passageId: string,
  sentence: string,
  focusPoints: SentenceChallengeFocusPoint[],
  firstAnswer: string,
  secondAnswer: string,
): Promise<SentenceChallengeResult<FinalSentenceReview>> {
  const loaded = await loadPassage(passageId);
  if ("error" in loaded) return { error: loaded.error };
  if (!secondAnswer.trim()) return { error: "Please write your second translation." };

  try {
    const data = await structuredResponse(
      finalReviewJsonSchema,
      [
        "You are a personal English tutor.",
        "Give a final review of the learner's sentence understanding.",
        "Compare meaning, grammar, important expressions, and overall understanding. Do not compare strings.",
        "Use scores only from: Excellent, Good, Needs another look. Do not use red X or the word wrong.",
        "Give a natural Japanese suggested translation.",
        "Mark expressions as save_for_review true only if the learner still misunderstood or partly understood them.",
        "",
        `Sentence: ${sentence}`,
        `Focus points: ${JSON.stringify(focusPoints)}`,
        `First answer: ${firstAnswer}`,
        `Second answer: ${secondAnswer}`,
      ].join("\n"),
      finalReviewSchema,
    );

    const toSave = data.important_points.filter((point) => point.save_for_review);
    if (toSave.length) {
      const { error } = await loaded.supabase.from("expressions").insert(toSave.map((point) => ({
        user_id: loaded.user.id,
        passage_id: loaded.passage.id,
        target_expression: point.expression,
        source_sentence: sentence,
        user_memo: `Sentence Challenge: ${point.feedback}`,
        learning_status: "unreviewed",
        category: "other",
      })));
      if (error) {
        console.error("Sentence Challenge review expression save failed", { code: error.code, message: error.message });
      }
    }

    return { success: true, data: { ...data, savedExpressions: toSave.length } };
  } catch (error) {
    console.error("Sentence Challenge final review failed", { message: errorMessage(error) });
    return { error: "Could not finish the review. Please try again." };
  }
}
