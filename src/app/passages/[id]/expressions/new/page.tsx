import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExpressionForm } from "@/components/expression-form";
import { createExpressionForPassage } from "@/actions/expressions";
import { createClient } from "@/lib/supabase/server";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Passage } from "@/types/database";

export default async function NewPassageExpressionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const passage = data as Passage;
  const action = createExpressionForPassage.bind(null, id);

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 900 }}>
        <Link href={`/passages/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passage
        </Link>
        <p className="eyebrow">Expression from passage</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>Add expression from this passage</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>This will be saved with “{passage.title}”. The full passage text will not be copied.</p>
        <div className="notice" style={{ marginBottom: 20 }}>
          Only the expression is required. If you can, also save the sentence where you found it.
        </div>
        <ExpressionForm action={action} quick />
      </div>
    </AppShell>
  );
}
