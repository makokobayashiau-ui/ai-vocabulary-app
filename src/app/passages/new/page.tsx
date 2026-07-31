import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PassageForm } from "@/components/passage-form";
import { createPassage } from "@/actions/passages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add passage" };

export default async function NewPassagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 900 }}>
        <Link href="/passages" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passages
        </Link>
        <p className="eyebrow">New passage</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>Add passage</h1>
        <p className="subtitle" style={{ marginBottom: 28 }}>Save one passage. Later, you can add words and phrases from it.</p>
        <PassageForm action={createPassage} />
      </div>
    </AppShell>
  );
}
