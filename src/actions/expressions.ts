"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { expressionIdSchema, formDataToCreateExpression, formDataToUpdateExpression } from "@/lib/validation/expression";
import { passageIdSchema } from "@/lib/validation/passage";

export type ExpressionActionState = { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; occurrenceCount?: number | null };
export type SelectionExpressionActionState = {
  error?: string;
  success?: boolean;
  expressionId?: string;
  occurrenceCount?: number | null;
  message?: string;
  debug?: unknown;
};

type SelectionExpressionInsert = {
  target_expression: string;
  passage_id: string;
  selection_start: number;
  selection_end: number;
  learning_status: "unreviewed";
  user_id: string;
};

function codePointLength(value: string) {
  return Array.from(value).length;
}

function sliceCodePoints(value: string, start: number, end: number) {
  return Array.from(value).slice(start, end).join("");
}

const selectionExpressionSchema = z.object({
  selectedText: z.string().trim().min(1).refine((value) => codePointLength(value) <= 300),
  selectionStart: z.number().int().min(0),
  selectionEnd: z.number().int().positive(),
}).refine((value) => value.selectionEnd > value.selectionStart, {
  message: "selectionEnd must be greater than selectionStart",
  path: ["selectionEnd"],
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function validationState(result: ReturnType<typeof formDataToCreateExpression> | ReturnType<typeof formDataToUpdateExpression>): ExpressionActionState | null {
  if (result.success) return null;
  return { error: "Please check your input.", fieldErrors: result.error.flatten().fieldErrors };
}

async function expressionOccurrenceCount(supabase: Awaited<ReturnType<typeof createClient>>, targetExpression: string) {
  const { data, error } = await supabase.rpc("count_expression_occurrences", { target_value: targetExpression });
  if (error) {
    console.error("count_expression_occurrences failed after expression insert", { code: error.code, message: error.message });
    return null;
  }
  return typeof data === "number" ? data : null;
}

function occurrenceMessage(count?: number | null) {
  if (typeof count === "number") return `Saved. You have saved this expression ${count} times.`;
  return "Saved. Could not check the count.";
}

export async function createExpression(_: ExpressionActionState, formData: FormData): Promise<ExpressionActionState> {
  const parsed = formDataToCreateExpression(formData);
  const invalid = validationState(parsed);
  if (invalid || !parsed.success) return invalid!;
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("expressions").insert({
    target_expression: parsed.data.target_expression,
    source_sentence: parsed.data.source_sentence,
    source_passage: parsed.data.source_passage,
    source_title: parsed.data.source_title,
    category: parsed.data.category,
    user_memo: parsed.data.user_memo,
    learning_status: "unreviewed",
    user_id: user.id,
  });
  if (error) return { error: "Could not save. Please try again." };
  const occurrenceCount = await expressionOccurrenceCount(supabase, parsed.data.target_expression);
  revalidatePath("/");
  revalidatePath("/expressions");
  return { success: true, occurrenceCount };
}

export async function createExpressionForPassage(passageId: string, _: ExpressionActionState, formData: FormData): Promise<ExpressionActionState> {
  if (!passageIdSchema.safeParse(passageId).success) return { error: "Please check your input." };
  const parsed = formDataToCreateExpression(formData);
  const invalid = validationState(parsed);
  if (invalid || !parsed.success) return invalid!;

  const { supabase, user } = await authenticatedClient();
  const { data: passage } = await supabase.from("passages").select("id")
    .eq("id", passageId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!passage) return { error: "This passage was not found, or it was deleted." };

  const { error } = await supabase.from("expressions").insert({
    target_expression: parsed.data.target_expression,
    source_sentence: parsed.data.source_sentence,
    source_passage: parsed.data.source_passage,
    source_title: parsed.data.source_title,
    category: parsed.data.category,
    user_memo: parsed.data.user_memo,
    learning_status: "unreviewed",
    passage_id: passage.id,
    user_id: user.id,
  });
  if (error) return { error: "Could not save. Please try again." };
  const occurrenceCount = await expressionOccurrenceCount(supabase, parsed.data.target_expression);

  revalidatePath("/");
  revalidatePath("/expressions");
  revalidatePath(`/passages/${passage.id}`);
  return { success: true, occurrenceCount };
}

export async function createExpressionFromSelection(
  passageId: string,
  selectedText: string,
  selectionStart: number,
  selectionEnd: number,
): Promise<SelectionExpressionActionState> {
  const baseDebug = {
    action: "createExpressionFromSelection",
    input: {
      passageId,
      selectedText,
      selectedTextCodePoints: codePointLength(selectedText),
      selectionStart,
      selectionEnd,
    },
  };

  try {
    if (!passageIdSchema.safeParse(passageId).success) {
      return { error: "Invalid passageId", debug: { ...baseDebug, step: "validate-passage-id", failure: "invalid-uuid" } };
    }
    if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) {
      return { error: "Invalid selection integer values", debug: { ...baseDebug, step: "validate-integers", failure: "not-integer" } };
    }
    const parsed = selectionExpressionSchema.safeParse({ selectedText, selectionStart, selectionEnd });
    if (!parsed.success) {
      const debug = { ...baseDebug, step: "zod-parse", failure: "invalid-selection-schema", zodIssues: parsed.error.issues };
      console.error("createExpressionFromSelection validation failed", debug);
      return { error: "Selection validation failed", debug };
    }

    const { supabase, user } = await authenticatedClient();
    const { data: passage, error: passageError } = await supabase.from("passages").select("id, content")
      .eq("id", passageId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (passageError || !passage) {
      const debug = {
        ...baseDebug,
        step: "fetch-passage",
        userId: user.id,
        passageFound: Boolean(passage),
        supabaseError: passageError ? {
          code: passageError.code,
          message: passageError.message,
          details: passageError.details,
          hint: passageError.hint,
        } : null,
      };
      console.error("createExpressionFromSelection passage fetch failed", debug);
      return { error: passageError?.message ?? "Passage not found", debug };
    }

    const passageContentCodePoints = codePointLength(passage.content);
    const slicedText = sliceCodePoints(passage.content, parsed.data.selectionStart, parsed.data.selectionEnd);
    if (parsed.data.selectionEnd > passageContentCodePoints) {
      const debug = { ...baseDebug, step: "validate-range-length", passageContentCodePoints, failure: "selection-end-out-of-range" };
      console.error("createExpressionFromSelection range length failed", debug);
      return { error: "Selection end is outside passage content", debug };
    }
    if (slicedText !== parsed.data.selectedText) {
      const debug = {
        ...baseDebug,
        step: "validate-slice-match",
        passageContentCodePoints,
        slicedText,
        failure: "slice-does-not-match-selected-text",
      };
      console.error("createExpressionFromSelection slice match failed", debug);
      return { error: "Selection text does not match passage content", debug };
    }

    const insertPayload: SelectionExpressionInsert = {
      target_expression: parsed.data.selectedText,
      passage_id: passage.id,
      selection_start: parsed.data.selectionStart,
      selection_end: parsed.data.selectionEnd,
      learning_status: "unreviewed",
      user_id: user.id,
    };
    const { data, error } = await supabase.from("expressions").insert(insertPayload).select("id").single();

    if (error || !data) {
      const debug = {
        ...baseDebug,
        step: "insert-expression",
        insertPayload,
        insertedData: data,
        supabaseError: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        } : null,
      };
      console.error("createExpressionFromSelection insert failed", debug);
      return { error: error?.message ?? "Expression insert returned no data", debug };
    }

    const occurrenceCount = await expressionOccurrenceCount(supabase, parsed.data.selectedText);
    revalidatePath("/");
    revalidatePath("/expressions");
    revalidatePath(`/passages/${passage.id}/expressions`);

    return {
      success: true,
      expressionId: data.id,
      occurrenceCount,
      message: occurrenceMessage(occurrenceCount),
      debug: { ...baseDebug, step: "success", expressionId: data.id, occurrenceCount },
    };
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const debug = {
      ...baseDebug,
      step: "exception",
      exception: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };
    console.error("createExpressionFromSelection threw exception", debug);
    return { error: error.message, debug };
  }
}

export async function updateExpression(id: string, _: ExpressionActionState, formData: FormData): Promise<ExpressionActionState> {
  if (!expressionIdSchema.safeParse(id).success) return { error: "Please check your input." };
  const parsed = formDataToUpdateExpression(formData);
  const invalid = validationState(parsed);
  if (invalid || !parsed.success) return invalid!;
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase.from("expressions").update(parsed.data)
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return { error: "Could not update it. It may not exist." };
  revalidatePath("/");
  revalidatePath("/expressions");
  revalidatePath(`/expressions/${id}`);
  redirect(`/expressions/${id}?updated=1`);
}

export async function deleteExpression(id: string) {
  if (!expressionIdSchema.safeParse(id).success) redirect("/expressions");
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("expressions").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null);
  if (error) redirect(`/expressions/${id}?error=${encodeURIComponent("Could not delete.")}`);
  revalidatePath("/");
  revalidatePath("/expressions");
  redirect("/expressions?deleted=1");
}
