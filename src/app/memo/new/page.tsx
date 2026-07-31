import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpressionForm } from "@/components/expression-form";
import { createExpression } from "@/actions/expressions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quick Memo" };

export default async function NewMemoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 850 }}>
        <p className="eyebrow">Quick memo</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>Just save it for now.</h1>
        <p className="subtitle" style={{ marginBottom: 28 }}>
          You do not need to check the meaning now. Save the expression and keep reading.
        </p>
        <ExpressionForm action={createExpression} quick />
      </div>
    </AppShell>
  );
}
