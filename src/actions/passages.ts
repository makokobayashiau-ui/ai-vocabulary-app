"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToPassage, formDataToPassageMetadata, passageIdSchema } from "@/lib/validation/passage";

export type PassageActionState = { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean };

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function invalidInputState(fieldErrors?: Record<string, string[]>): PassageActionState {
  return { error: "Please check your input.", fieldErrors };
}

export async function createPassage(_: PassageActionState, formData: FormData): Promise<PassageActionState> {
  const parsed = formDataToPassage(formData);
  if (!parsed.success) return invalidInputState(parsed.error.flatten().fieldErrors);

  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase.from("passages").insert({ ...parsed.data, user_id: user.id }).select("id").single();
  if (error || !data) return { error: "Could not save the passage. Please try again." };

  revalidatePath("/");
  revalidatePath("/passages");
  redirect(`/passages/${data.id}`);
}

export async function updatePassage(id: string, _: PassageActionState, formData: FormData): Promise<PassageActionState> {
  if (!passageIdSchema.safeParse(id).success) return invalidInputState();

  const { supabase, user } = await authenticatedClient();
  const { data: existing } = await supabase.from("passages").select("id")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!existing) return { error: "Could not update the passage. It may not exist." };

  const { count: linkedExpressionCount, error: countError } = await supabase.from("expressions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("passage_id", id).is("deleted_at", null);
  if (countError) return { error: "Could not update the passage. Please try again." };

  const contentLocked = (linkedExpressionCount ?? 0) > 0;
  const parsed = contentLocked ? formDataToPassageMetadata(formData) : formDataToPassage(formData);
  if (!parsed.success) return invalidInputState(parsed.error.flatten().fieldErrors);

  const { data, error } = await supabase.from("passages").update(parsed.data)
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return { error: "Could not update the passage. It may not exist." };

  revalidatePath("/");
  revalidatePath("/passages");
  revalidatePath(`/passages/${id}`);
  redirect(`/passages/${id}?updated=1`);
}

export async function deletePassage(id: string) {
  if (!passageIdSchema.safeParse(id).success) redirect("/passages");
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("passages").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null);
  if (error) redirect(`/passages/${id}?error=${encodeURIComponent("Could not delete.")}`);

  revalidatePath("/");
  revalidatePath("/passages");
  redirect("/passages?deleted=1");
}
