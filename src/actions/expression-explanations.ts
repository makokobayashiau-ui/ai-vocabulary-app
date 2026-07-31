"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXPRESSION_TYPES } from "@/lib/constants";
import { aiExplanationSchema, type AiExplanationOutput } from "@/lib/validation/explanation";
import { normalizedExpressionSchema } from "@/lib/validation/expression-group";
import type { Expression, Passage } from "@/types/database";

const PROMPT_VERSION = "expression-explanation-v7-japanese-reading-required";
const DEFAULT_MODEL = "gpt-4.1-mini";
const STALE_PENDING_MS = 10 * 60 * 1000;

export type GenerateExplanationResult = {
  success?: boolean;
  error?: string;
  status?: "completed" | "pending" | "failed";
  skipped?: boolean;
  debugReason?: string;
  expressionId?: string;
  expressionText?: string;
  normalizedExpression?: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type ExpressionContext = Pick<
  Expression,
  "id" | "target_expression" | "normalized_expression" | "source_sentence" | "source_passage" | "source_title" | "user_memo" | "passage_id" | "created_at"
> & {
  passage_title: string | null;
  passage_content_excerpt: string | null;
};

function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function modelName() {
  return process.env.OPENAI_EXPLANATION_MODEL?.trim() || DEFAULT_MODEL;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

function devReason(value: string) {
  return process.env.NODE_ENV === "development" ? value : undefined;
}

function supabaseErrorInfo(error: SupabaseErrorLike | null | undefined) {
  if (!error) return null;
  return {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function supabaseDevReason(prefix: string, error: SupabaseErrorLike | null | undefined) {
  const info = supabaseErrorInfo(error);
  if (!info) return devReason(prefix);
  return devReason(`${prefix}: ${info.code ?? "no-code"} ${info.message ?? "no-message"}${info.details ? ` details=${info.details}` : ""}${info.hint ? ` hint=${info.hint}` : ""}`);
}

function errorInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
    stack: null,
  };
}

function isStalePending(updatedAt: string | null | undefined) {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > STALE_PENDING_MS;
}

function compactText(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function loadExpressionContexts(supabase: SupabaseServerClient, userId: string, normalizedExpression: string) {
  const { data, error } = await supabase.from("expressions")
    .select("id,target_expression,normalized_expression,source_sentence,source_passage,source_title,user_memo,passage_id,created_at")
    .eq("user_id", userId)
    .eq("normalized_expression", normalizedExpression)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Failed to load expression contexts for explanation", { code: error.code, message: error.message });
    return { contexts: [] as ExpressionContext[], displayExpression: null };
  }

  const expressions = (data ?? []) as Pick<
    Expression,
    "id" | "target_expression" | "normalized_expression" | "source_sentence" | "source_passage" | "source_title" | "user_memo" | "passage_id" | "created_at"
  >[];

  if (!expressions.length) return { contexts: [] as ExpressionContext[], displayExpression: null };

  const passageIds = [...new Set(expressions.map((item) => item.passage_id).filter((value): value is string => Boolean(value)))];
  const { data: passageData, error: passageError } = passageIds.length
    ? await supabase.from("passages")
      .select("id,title,content")
      .in("id", passageIds)
      .eq("user_id", userId)
      .is("deleted_at", null)
    : { data: [] as Pick<Passage, "id" | "title" | "content">[], error: null };

  if (passageError) {
    console.error("Failed to load passage contexts for explanation", { code: passageError.code, message: passageError.message });
  }

  const passageById = new Map(((passageData ?? []) as Pick<Passage, "id" | "title" | "content">[]).map((passage) => [passage.id, passage]));
  const contexts = expressions.map((expression) => {
    const passage = expression.passage_id ? passageById.get(expression.passage_id) : null;
    return {
      ...expression,
      source_sentence: compactText(expression.source_sentence, 700),
      source_passage: compactText(expression.source_passage, 1200),
      user_memo: compactText(expression.user_memo, 500),
      passage_title: passage?.title ?? null,
      passage_content_excerpt: compactText(passage?.content, 1800),
    };
  });

  return { contexts, displayExpression: expressions[0].target_expression };
}

function buildPrompt(normalizedExpression: string, displayExpression: string, contexts: ExpressionContext[]) {
  return [
    "You are writing for a Japanese learner of English.",
    "Explain the meaning in the saved context first, but keep the explanation general enough to be reused for the same normalized expression.",
    "Prioritize easy understanding over information amount.",
    "Write like a simple learner's dictionary.",
    "Use CEFR A2-B1 level English for English fields. IELTS learners should understand it easily.",
    "Use short, common words. When a word is difficult, choose an easier word.",
    "Avoid difficult grammar terms.",
    "If the expression is a phrasal verb, idiom, collocation, noun phrase, or fixed expression, classify it as the full expression, not only one word.",
    "simple_english_explanation: under 30 words, usually 1 or 2 short sentences. Do not include long background or usage situations. Do not repeat the target expression too much.",
    "example_sentences: exactly 3 sentences in this fixed order: index 0 Daily, index 1 Work, index 2 Academic. Each sentence must be about 15 words or fewer. Make them natural and not too similar.",
    "Academic examples should still be easy enough for an IELTS learner at CEFR A2-B1.",
    "collocations: generate up to 5 natural short collocations or phrases often used with the target expression. Prefer verbs and prepositions. Use an empty array if there are no natural collocations.",
    "synonyms: generate up to 4 useful similar expressions. Each item needs an English expression and a short Japanese meaning. Use an empty array if there is no useful synonym.",
    "antonyms: generate up to 3 natural opposite expressions only when natural. Use an empty array if there is no good antonym.",
    "japanese_meaning: concise natural Japanese, like a dictionary. Start with a short translation. Add one short second line only if useful.",
    "japanese_meaning_hiragana: the natural hiragana reading of japanese_meaning. This field is required. Use hiragana and spaces only when helpful. Do not use katakana unless the Japanese word itself is normally written in katakana.",
    "japanese_meaning_romaji: standard Hepburn romanization of japanese_meaning_hiragana. This field is required. Use spaces between words only when helpful. Use hyphens only when they help a beginner read the word naturally, such as seijitsu-sa.",
    "usage_notes: Write Usage Notes in simple English. Explain when and how the expression is naturally used. CEFR A2-B1. 1 to 3 practical sentences. 50 words or fewer.",
    "usage_notes_ja: Write a natural Japanese translation of usage_notes. Japanese fields must translate the corresponding English fields. Do not add extra information only to the Japanese translation.",
    "mnemonic: Write the mnemonic in simple English. CEFR A2-B1. 1 or 2 short sentences, under 30 words total. Make it visual and clearly connected to the expression.",
    "mnemonic_ja: Write a natural Japanese translation of mnemonic. Do not add extra information only to the Japanese translation.",
    "mini_quiz: keep the question and options short and easy. It should test the meaning in context.",
    "Do not output HTML or Markdown.",
    "Do not use markdown inside JSON values.",
    "Keep all sections concise.",
    "Do not repeat the same explanation across sections.",
    "Always return japanese_meaning, japanese_meaning_hiragana, and japanese_meaning_romaji together.",
    "Return only valid JSON matching the schema.",
    "Return only the JSON object required by the schema.",
    "",
    `Normalized expression: ${normalizedExpression}`,
    `Display expression: ${displayExpression}`,
    "",
    "Saved contexts:",
    JSON.stringify(contexts.map((context) => ({
      target_expression: context.target_expression,
      source_sentence: context.source_sentence,
      source_passage: context.source_passage,
      source_title: context.source_title,
      passage_title: context.passage_title,
      passage_content_excerpt: context.passage_content_excerpt,
      user_memo: context.user_memo,
    })), null, 2),
  ].join("\n");
}

const explanationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "expression_type",
    "simple_english_explanation",
    "example_sentences",
    "japanese_meaning",
    "japanese_meaning_hiragana",
    "japanese_meaning_romaji",
    "usage_notes",
    "usage_notes_ja",
    "mnemonic",
    "mnemonic_ja",
    "mini_quiz",
    "collocations",
    "synonyms",
    "antonyms",
  ],
  properties: {
    expression_type: { type: "string", enum: EXPRESSION_TYPES },
    simple_english_explanation: {
      type: "string",
      minLength: 1,
      maxLength: 220,
      description: "CEFR A2-B1 simple English. Under 30 words. Usually 1 or 2 short dictionary-like sentences.",
    },
    example_sentences: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 120 },
      description: "Three natural example sentences. Each sentence must include the target expression and be 15 words or fewer.",
    },
    japanese_meaning: { type: "string", minLength: 1, maxLength: 80 },
    japanese_meaning_hiragana: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      description: "Natural hiragana reading of japanese_meaning. Required.",
    },
    japanese_meaning_romaji: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description: "Standard Hepburn romanization of japanese_meaning_hiragana. Required.",
    },
    usage_notes: {
      type: "string",
      minLength: 1,
      maxLength: 360,
      description: "Simple English usage notes. CEFR A2-B1. 1 to 3 sentences. 50 words or fewer.",
    },
    usage_notes_ja: {
      type: "string",
      minLength: 1,
      maxLength: 220,
      description: "Natural Japanese translation of usage_notes. Do not add new information.",
    },
    mnemonic: {
      type: "string",
      minLength: 1,
      maxLength: 220,
      description: "A short English memory hint. 1 or 2 sentences. Under 30 words total.",
    },
    mnemonic_ja: {
      type: "string",
      minLength: 1,
      maxLength: 180,
      description: "Natural Japanese translation of mnemonic. Do not add new information.",
    },
    mini_quiz: {
      type: "object",
      additionalProperties: false,
      required: ["quiz_type", "question", "options", "correct_answer_index", "explanation"],
      properties: {
        quiz_type: { type: "string", enum: ["multiple_choice", "fill_in_the_blank"] },
        question: { type: "string", minLength: 1, maxLength: 240 },
        options: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: { type: "string", minLength: 1, maxLength: 120 },
        },
        correct_answer_index: { type: "integer", minimum: 0, maximum: 3 },
        explanation: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    collocations: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 80 },
      description: "Natural collocations or short phrases used with the expression.",
    },
    synonyms: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expression", "japanese"],
        properties: {
          expression: { type: "string", minLength: 1, maxLength: 80 },
          japanese: { type: ["string", "null"], maxLength: 60 },
        },
      },
    },
    antonyms: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expression", "japanese"],
        properties: {
          expression: { type: "string", minLength: 1, maxLength: 80 },
          japanese: { type: ["string", "null"], maxLength: 60 },
        },
      },
    },
  },
} as const;

async function generateWithOpenAI(normalizedExpression: string, displayExpression: string, contexts: ExpressionContext[]): Promise<AiExplanationOutput> {
  const client = openaiClient();
  if (!client) throw new Error("OPENAI_API_KEY is not configured.");

  console.info("OpenAI explanation generation started", {
    normalizedExpression,
    displayExpression,
    contextCount: contexts.length,
    model: modelName(),
    promptVersion: PROMPT_VERSION,
  });

  const response = await client.responses.create({
    model: modelName(),
    input: buildPrompt(normalizedExpression, displayExpression, contexts),
    text: {
      format: {
        type: "json_schema",
        name: "expression_explanation",
        strict: true,
        schema: explanationJsonSchema,
      },
    },
  });

  const rawText = response.output_text;
  if (!rawText) throw new Error("OpenAI response did not include output_text.");

  const parsedJson = JSON.parse(rawText) as unknown;
  const parsed = aiExplanationSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("OpenAI explanation output failed validation", JSON.stringify({ issues: parsed.error.issues }, null, 2));
    throw new Error("OpenAI response failed validation.");
  }
  console.info("OpenAI explanation generation succeeded", {
    normalizedExpression,
    displayExpression,
    model: modelName(),
    promptVersion: PROMPT_VERSION,
  });
  return parsed.data;
}

async function markFailed(supabase: SupabaseServerClient, userId: string, normalizedExpression: string, displayExpression: string, reason: string) {
  const { error } = await supabase.from("expression_explanations").upsert({
    user_id: userId,
    normalized_expression: normalizedExpression,
    display_expression: displayExpression,
    generation_status: "failed",
    error_message: reason,
    model: modelName(),
    prompt_version: PROMPT_VERSION,
  }, { onConflict: "user_id,normalized_expression" });

  if (error) {
    console.error("Failed to mark expression explanation as failed", JSON.stringify(supabaseErrorInfo(error), null, 2));
  }
}

export async function generateExpressionExplanation(normalizedExpression: string, options: { force?: boolean } = {}): Promise<GenerateExplanationResult> {
  const parsed = normalizedExpressionSchema.safeParse(normalizedExpression);
  if (!parsed.success) {
    return { error: "Please check this expression.", status: "failed", debugReason: devReason("Invalid normalized expression.") };
  }

  const normalized = parsed.data;
  const { supabase, user } = await authenticatedClient();
  console.info("AI explanation request authenticated", {
    normalizedExpression: normalized,
    hasUserId: Boolean(user.id),
    force: Boolean(options.force),
  });

  const { contexts, displayExpression } = await loadExpressionContexts(supabase, user.id, normalized);
  const primaryContext = contexts[0] ?? null;
  const baseResult = {
    expressionId: primaryContext?.id,
    expressionText: displayExpression ?? primaryContext?.target_expression,
    normalizedExpression: normalized,
  };
  console.info("AI explanation expression context loaded", {
    expressionId: primaryContext?.id ?? null,
    expressionText: displayExpression ?? null,
    normalizedExpression: normalized,
    contextCount: contexts.length,
  });
  if (!contexts.length || !displayExpression) {
    return { ...baseResult, error: "This expression was not found.", status: "failed", debugReason: devReason("No non-deleted expression contexts found.") };
  }

  const { data: existing, error: existingError } = await supabase.from("expression_explanations")
    .select("id,user_id,normalized_expression,generation_status,updated_at,prompt_version")
    .eq("user_id", user.id)
    .eq("normalized_expression", normalized)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to read existing expression explanation", JSON.stringify(supabaseErrorInfo(existingError), null, 2));
    return { ...baseResult, error: "Could not check the AI explanation.", status: "failed", debugReason: supabaseDevReason("Failed to read existing explanation", existingError) };
  }

  if (existing?.generation_status === "completed" && !options.force) {
    revalidatePath("/expressions");
    revalidatePath(`/expressions/group?normalized=${encodeURIComponent(normalized)}`);
    console.info("AI explanation skipped because it is already completed", {
      expressionId: primaryContext.id,
      expressionText: displayExpression,
      normalizedExpression: normalized,
      explanationId: existing.id,
    });
    return { ...baseResult, success: true, skipped: true, status: "completed" };
  }

  if (existing?.generation_status === "completed" && options.force) {
    try {
      const output = await generateWithOpenAI(normalized, displayExpression, contexts);
      const { data: updatedRows, error: updateError } = await supabase.from("expression_explanations")
        .update({
          ...output,
          display_expression: displayExpression,
          generation_status: "completed",
          error_message: null,
          model: modelName(),
          prompt_version: PROMPT_VERSION,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .eq("generation_status", "completed")
        .select("id,prompt_version,generation_status");

      if (updateError) {
        console.error("Failed to replace completed expression explanation", JSON.stringify(supabaseErrorInfo(updateError), null, 2));
        return { ...baseResult, error: "Could not update the AI explanation. Please try again.", status: "failed", debugReason: supabaseDevReason("Failed to update completed explanation", updateError) };
      }
      if (!updatedRows?.length) {
        console.error("Completed expression explanation update matched no rows", {
          explanationId: existing.id,
          normalizedExpression: normalized,
          previousPromptVersion: existing.prompt_version,
        });
        return { ...baseResult, error: "Could not update the AI explanation. Please refresh the page and try again.", status: "failed", debugReason: devReason("Completed explanation update matched no rows.") };
      }
    } catch (error) {
      console.error("Failed to regenerate completed expression explanation", JSON.stringify(errorInfo(error), null, 2));
      return { ...baseResult, error: "Could not create it again. The old explanation is still safe.", status: "failed", debugReason: devReason(error instanceof Error ? error.message : "Unknown OpenAI regeneration error") };
    }

    revalidatePath("/expressions");
    revalidatePath(`/expressions/group?normalized=${encodeURIComponent(normalized)}`);
    return { ...baseResult, success: true, status: "completed" };
  }

  if (existing?.generation_status === "pending" && !isStalePending(existing.updated_at)) {
    console.info("AI explanation skipped because a fresh pending row exists", {
      expressionId: primaryContext.id,
      expressionText: displayExpression,
      normalizedExpression: normalized,
      explanationId: existing.id,
      updatedAt: existing.updated_at,
    });
    return { ...baseResult, success: true, skipped: true, error: "The AI explanation is being created. Please wait, then refresh.", status: "pending", debugReason: devReason("Fresh pending explanation exists.") };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("expression_explanations").insert({
      user_id: user.id,
      normalized_expression: normalized,
      display_expression: displayExpression,
      generation_status: "pending",
      model: modelName(),
      prompt_version: PROMPT_VERSION,
    });

    if (isUniqueViolation(insertError)) {
      console.info("AI explanation skipped because pending insert hit unique conflict", {
        expressionId: primaryContext.id,
        expressionText: displayExpression,
        normalizedExpression: normalized,
      });
      return { ...baseResult, success: true, skipped: true, error: "The AI explanation is being created. Please wait, then refresh.", status: "pending", debugReason: devReason("Unique conflict while reserving generation.") };
    }
    if (insertError) {
      console.error("Failed to reserve expression explanation generation", JSON.stringify(supabaseErrorInfo(insertError), null, 2));
      return { ...baseResult, error: "Could not start the AI explanation.", status: "failed", debugReason: supabaseDevReason("Failed to insert pending explanation", insertError) };
    }
    console.info("AI explanation pending row inserted", {
      expressionId: primaryContext.id,
      expressionText: displayExpression,
      normalizedExpression: normalized,
    });
  } else {
    const { error: pendingError } = await supabase.from("expression_explanations")
      .update({
        display_expression: displayExpression,
        generation_status: "pending",
        error_message: null,
        model: modelName(),
        prompt_version: PROMPT_VERSION,
      })
      .eq("user_id", user.id)
      .eq("normalized_expression", normalized)
      .neq("generation_status", "completed");

    if (pendingError) {
      console.error("Failed to reserve expression explanation retry", JSON.stringify(supabaseErrorInfo(pendingError), null, 2));
      return { ...baseResult, error: "Could not try again.", status: "failed", debugReason: supabaseDevReason("Failed to update explanation to pending", pendingError) };
    }
    console.info("AI explanation retry reserved", {
      expressionId: primaryContext.id,
      expressionText: displayExpression,
      normalizedExpression: normalized,
      previousStatus: existing.generation_status,
    });
  }

  try {
    const output = await generateWithOpenAI(normalized, displayExpression, contexts);
    const { data: savedRows, error: updateError } = await supabase.from("expression_explanations")
      .update({
        ...output,
        display_expression: displayExpression,
        generation_status: "completed",
        error_message: null,
        model: modelName(),
        prompt_version: PROMPT_VERSION,
      })
      .eq("user_id", user.id)
      .eq("normalized_expression", normalized)
      .select("id,prompt_version,generation_status");

    if (updateError) {
      console.error("Failed to save generated expression explanation", JSON.stringify(supabaseErrorInfo(updateError), null, 2));
      await markFailed(supabase, user.id, normalized, displayExpression, "Generated explanation could not be saved.");
      return { ...baseResult, error: "Could not save the AI explanation. Please try again.", status: "failed", debugReason: supabaseDevReason("Failed to update generated explanation", updateError) };
    }
    if (!savedRows?.length) {
      console.error("Generated expression explanation update matched no rows", {
        expressionId: primaryContext.id,
        expressionText: displayExpression,
        normalizedExpression: normalized,
      });
      await markFailed(supabase, user.id, normalized, displayExpression, "Generated explanation update matched no rows.");
      return { ...baseResult, error: "Could not save the AI explanation. Please refresh the page and try again.", status: "failed", debugReason: devReason("Generated explanation update matched no rows.") };
    }
    console.info("Generated expression explanation saved", {
      expressionId: primaryContext.id,
      expressionText: displayExpression,
      normalizedExpression: normalized,
      explanationId: savedRows[0]?.id,
      promptVersion: savedRows[0]?.prompt_version,
      generationStatus: savedRows[0]?.generation_status,
    });
  } catch (error) {
    console.error("Failed to generate expression explanation", JSON.stringify(errorInfo(error), null, 2));
    await markFailed(supabase, user.id, normalized, displayExpression, "AI explanation generation failed.");
    revalidatePath("/expressions");
    revalidatePath(`/expressions/group?normalized=${encodeURIComponent(normalized)}`);
    return { ...baseResult, error: "Could not create the AI explanation. Please wait a little and try again.", status: "failed", debugReason: devReason(error instanceof Error ? error.message : "Unknown OpenAI generation error") };
  }

  revalidatePath("/expressions");
  revalidatePath(`/expressions/group?normalized=${encodeURIComponent(normalized)}`);
  return { ...baseResult, success: true, status: "completed" };
}
