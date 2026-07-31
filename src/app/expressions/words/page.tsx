import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/feedback-states";
import { createClient } from "@/lib/supabase/server";
import { EXPRESSION_GROUP_STATUS_LABELS } from "@/lib/constants";
import type { Expression, ExpressionExplanation, ExpressionLearningState } from "@/types/database";

export const metadata: Metadata = { title: "Word list | Context Words" };

type WordRow = {
  normalizedExpression: string;
  displayExpression: string;
  explanation: Pick<ExpressionExplanation, "simple_english_explanation" | "japanese_meaning" | "generation_status"> | null;
  learningState: Pick<ExpressionLearningState, "learning_status"> | null;
};

function groupHref(normalizedExpression: string) {
  return `/expressions/group?normalized=${encodeURIComponent(normalizedExpression)}`;
}

export default async function RegisteredWordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: expressionData, error: expressionError } = await supabase.from("expressions")
    .select("id,target_expression,normalized_expression,created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (expressionError) {
    console.error("Failed to load registered words", { code: expressionError.code, message: expressionError.message });
  }

  const expressions = (expressionData ?? []) as Pick<Expression, "id" | "target_expression" | "normalized_expression" | "created_at">[];
  const latestByNormalized = new Map<string, Pick<Expression, "id" | "target_expression" | "normalized_expression" | "created_at">>();
  for (const expression of expressions) {
    if (!latestByNormalized.has(expression.normalized_expression)) {
      latestByNormalized.set(expression.normalized_expression, expression);
    }
  }

  const normalizedValues = [...latestByNormalized.keys()];
  const { data: explanationData, error: explanationError } = normalizedValues.length
    ? await supabase.from("expression_explanations")
      .select("normalized_expression,simple_english_explanation,japanese_meaning,generation_status")
      .eq("user_id", user.id)
      .in("normalized_expression", normalizedValues)
    : { data: [], error: null };

  if (explanationError) {
    console.error("Failed to load registered word explanations", { code: explanationError.code, message: explanationError.message });
  }

  const { data: stateData, error: stateError } = normalizedValues.length
    ? await supabase.from("expression_learning_states")
      .select("normalized_expression,learning_status")
      .eq("user_id", user.id)
      .in("normalized_expression", normalizedValues)
    : { data: [], error: null };

  if (stateError) {
    console.error("Failed to load registered word learning states", { code: stateError.code, message: stateError.message });
  }

  const explanationByNormalized = new Map((explanationData ?? []).map((item) => [
    item.normalized_expression as string,
    item as Pick<ExpressionExplanation, "simple_english_explanation" | "japanese_meaning" | "generation_status">,
  ]));
  const stateByNormalized = new Map((stateData ?? []).map((item) => [
    item.normalized_expression as string,
    item as Pick<ExpressionLearningState, "learning_status">,
  ]));

  const rows: WordRow[] = [...latestByNormalized.values()].map((expression) => ({
    normalizedExpression: expression.normalized_expression,
    displayExpression: expression.target_expression,
    explanation: explanationByNormalized.get(expression.normalized_expression) ?? null,
    learningState: stateByNormalized.get(expression.normalized_expression) ?? null,
  }));

  return (
    <AppShell>
      <div className="shell page">
        <Link href="/expressions" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to expressions
        </Link>

        <div style={{ marginBottom: 22 }}>
          <p className="eyebrow">Registered words</p>
          <h1 className="title" style={{ marginTop: 9 }}>Word list</h1>
          <p className="subtitle" style={{ marginTop: 10 }}>
            Check Expression, Simple English, Japanese, and Learning state in one list.
          </p>
        </div>

        {rows.length ? (
          <div className="card expression-word-table-wrap">
            <table className="expression-word-table">
              <thead>
                <tr>
                  <th>Expression</th>
                  <th>Simple English</th>
                  <th>Japanese</th>
                  <th>Learning state</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.normalizedExpression}>
                    <td>
                      <Link href={groupHref(row.normalizedExpression)} className="word-table-expression">
                        {row.displayExpression}
                      </Link>
                    </td>
                    <td>{row.explanation?.simple_english_explanation ?? "No AI explanation yet"}</td>
                    <td>{row.explanation?.japanese_meaning ?? "Not ready"}</td>
                    <td>{EXPRESSION_GROUP_STATUS_LABELS[row.learningState?.learning_status ?? "new"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No words yet." message="Save expressions from Quick Memo or passages, and they will show here." actionHref="/memo/new" actionLabel="Add memo" />
        )}
      </div>
    </AppShell>
  );
}
