"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function authErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Please check your email and password.";
  if (lower.includes("email not confirmed")) return "Please check your email and open the confirmation link.";
  if (lower.includes("user already registered") || lower.includes("already been registered")) return "Could not sign up. If you already have an account, please log in.";
  if (lower.includes("password")) return "Please use a password with at least 6 characters.";
  if (lower.includes("rate limit")) return "Please wait a little, then try again.";
  return "Could not sign in. Please check your input and try again.";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(authErrorMessage(error.message))}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback` },
  });
  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(authErrorMessage(error.message))}`);
  if (data.user?.identities?.length === 0) {
    redirect(`/login?mode=signup&error=${encodeURIComponent("Could not sign up. If you already have an account, please log in.")}`);
  }
  redirect(`/login?checkEmail=${encodeURIComponent(email)}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
