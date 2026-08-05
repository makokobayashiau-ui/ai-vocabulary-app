import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SentenceChallengeWorkspace } from "@/components/sentence-challenge-workspace";
import { createClient } from "@/lib/supabase/server";
import { passageCategoryLabel } from "@/lib/constants";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Passage } from "@/types/database";

export default async function SentenceChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: passageData } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!passageData) notFound();
  const passage = passageData as Passage;

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 980 }}>
        <Link href={`/passages/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passage
        </Link>
        <p className="eyebrow">{passageCategoryLabel(passage.category)}</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>{passage.title}</h1>
        <p className="subtitle" style={{ marginBottom: 24 }}>
          Practice one important sentence with a tutor-style review.
        </p>
        <SentenceChallengeWorkspace passageId={passage.id} />
      </div>
    </AppShell>
  );
}
