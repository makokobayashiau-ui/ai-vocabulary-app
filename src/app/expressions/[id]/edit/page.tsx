import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpressionForm } from "@/components/expression-form";
import { createClient } from "@/lib/supabase/server";
import { updateExpression } from "@/actions/expressions";
import { expressionIdSchema } from "@/lib/validation/expression";
import type { Expression } from "@/types/database";

export default async function EditExpression({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!expressionIdSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("expressions").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();

  if (!data) notFound();

  const action = updateExpression.bind(null, id);
  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 850 }}>
        <p className="eyebrow">Edit memo</p>
        <h1 className="title" style={{ margin: "10px 0 28px" }}>Edit memo</h1>
        <ExpressionForm action={action} expression={data as Expression} />
      </div>
    </AppShell>
  );
}
