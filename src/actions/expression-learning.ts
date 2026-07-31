"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { expressionGroupLearningStatusSchema, normalizedExpressionSchema } from "@/lib/validation/expression-group";
import type { ExpressionLearningStatus } from "@/types/database";

export type ExpressionLearningActionState = { error?: string; success?: boolean };

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function ensureOwnedExpression(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, normalizedExpression: string) {
  const { data, error } = await supabase.from("expressions").select("id")
    .eq("user_id", userId)
    .eq("normalized_expression", normalizedExpression)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify expression ownership", { code: error.code, message: error.message });
    return false;
  }
  return Boolean(data);
}

function revalidateExpressionGroup(normalizedExpression: string) {
  revalidatePath("/expressions");
  revalidatePath(`/expressions/group?normalized=${encodeURIComponent(normalizedExpression)}`);
}

export async function updateLearningStatus(normalizedExpression: string, status: ExpressionLearningStatus): Promise<ExpressionLearningActionState> {
  const normalized = normalizedExpressionSchema.safeParse(normalizedExpression);
  const parsedStatus = expressionGroupLearningStatusSchema.safeParse(status);
  if (!normalized.success || !parsedStatus.success) return { error: "Please check your input." };

  const { supabase, user } = await authenticatedClient();
  const exists = await ensureOwnedExpression(supabase, user.id, normalized.data);
  if (!exists) return { error: "This expression was not found." };

  const { error } = await supabase.from("expression_learning_states").upsert({
    user_id: user.id,
    normalized_expression: normalized.data,
    learning_status: parsedStatus.data,
  }, { onConflict: "user_id,normalized_expression" });

  if (error) {
    console.error("Failed to update expression learning status", { code: error.code, message: error.message });
    return { error: "Could not update the learning state." };
  }

  revalidateExpressionGroup(normalized.data);
  return { success: true };
}

export async function toggleExpressionFavorite(normalizedExpression: string, nextFavorite: boolean): Promise<ExpressionLearningActionState> {
  const normalized = normalizedExpressionSchema.safeParse(normalizedExpression);
  if (!normalized.success) return { error: "Please check your input." };

  const { supabase, user } = await authenticatedClient();
  const exists = await ensureOwnedExpression(supabase, user.id, normalized.data);
  if (!exists) return { error: "This expression was not found." };

  const { data: current, error: currentError } = await supabase.from("expression_learning_states")
    .select("learning_status")
    .eq("user_id", user.id)
    .eq("normalized_expression", normalized.data)
    .maybeSingle();

  if (currentError) {
    console.error("Failed to read current favorite state", { code: currentError.code, message: currentError.message });
    return { error: "Could not update favorites." };
  }

  const { error } = await supabase.from("expression_learning_states").upsert({
    user_id: user.id,
    normalized_expression: normalized.data,
    learning_status: current?.learning_status ?? "new",
    is_favorite: nextFavorite,
  }, { onConflict: "user_id,normalized_expression" });

  if (error) {
    console.error("Failed to toggle expression favorite", { code: error.code, message: error.message });
    return { error: "Could not update favorites." };
  }

  revalidateExpressionGroup(normalized.data);
  return { success: true };
}
