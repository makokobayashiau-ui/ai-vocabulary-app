import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PassageForm } from "@/components/passage-form";
import { updatePassage } from "@/actions/passages";
import { createClient } from "@/lib/supabase/server";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Passage } from "@/types/database";

export default async function EditPassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();

  const { count } = await supabase.from("expressions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("passage_id", id).is("deleted_at", null);
  const action = updatePassage.bind(null, id);

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 900 }}>
        <Link href={`/passages/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passage
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <p className="eyebrow">Edit passage</p>
            <h1 className="title" style={{ margin: "10px 0 0" }}>Edit passage</h1>
          </div>
          <Link className="btn" href={`/passages/${id}/expressions`}><ListChecks size={17} />Saved expressions</Link>
        </div>
        <PassageForm action={action} passage={data as Passage} contentLocked={(count ?? 0) > 0} />
      </div>
    </AppShell>
  );
}
