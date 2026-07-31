import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeleteExpressionDialog } from "@/components/delete-expression-dialog";
import { ExplanationCard } from "@/components/explanation-card";
import { createClient } from "@/lib/supabase/server";
import { deleteExpression } from "@/actions/expressions";
import { STATUS_LABELS, categoryLabel } from "@/lib/constants";
import { expressionIdSchema } from "@/lib/validation/expression";
import { miniQuizSchema, relatedExpressionSchema } from "@/lib/validation/explanation";
import type { Expression, ExpressionExplanation, Passage } from "@/types/database";

function asExplanation(value: unknown): ExpressionExplanation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as ExpressionExplanation;
  const quiz = miniQuizSchema.safeParse(raw.mini_quiz);
  const collocations = Array.isArray(raw.collocations) ? raw.collocations.filter((item): item is string => typeof item === "string") : null;
  const synonyms = Array.isArray(raw.synonyms)
    ? raw.synonyms.map((item) => relatedExpressionSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : null;
  const antonyms = Array.isArray(raw.antonyms)
    ? raw.antonyms.map((item) => relatedExpressionSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : null;
  return {
    ...raw,
    mini_quiz: quiz.success ? quiz.data : null,
    example_sentences: Array.isArray(raw.example_sentences) ? raw.example_sentences.filter((item): item is string => typeof item === "string") : null,
    usage_notes_ja: typeof raw.usage_notes_ja === "string" ? raw.usage_notes_ja : null,
    mnemonic_ja: typeof raw.mnemonic_ja === "string" ? raw.mnemonic_ja : null,
    collocations,
    synonyms,
    antonyms,
  };
}

export default async function ExpressionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string; error?: string }> }) {
  const { id } = await params;
  if (!expressionIdSchema.safeParse(id).success) notFound();
  const notice = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("expressions").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const item = data as Expression;

  const { data: passageData } = item.passage_id
    ? await supabase.from("passages").select("id,title").eq("id", item.passage_id).eq("user_id", user.id).is("deleted_at", null).maybeSingle()
    : { data: null };
  const passage = passageData as Pick<Passage, "id" | "title"> | null;

  const { data: explanationData, error: explanationError } = await supabase.from("expression_explanations").select("*")
    .eq("user_id", user.id)
    .eq("normalized_expression", item.normalized_expression)
    .maybeSingle();
  if (explanationError) {
    console.error("Failed to load expression explanation", { code: explanationError.code, message: explanationError.message });
  }
  const explanation = asExplanation(explanationData);

  const remove = deleteExpression.bind(null, id);
  const sections = [
    { label: "Sentence where you found it", value: item.source_sentence },
    { label: "Text around it", value: item.source_passage },
    { label: "Source title", value: item.source_title },
    { label: "My note", value: item.user_memo },
  ];

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 900 }}>
        <Link href="/expressions" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to list
        </Link>
        {notice.updated && <div className="notice" style={{ marginBottom: 18 }}>Changes saved.</div>}
        {notice.error && <div className="notice notice-warn" style={{ marginBottom: 18 }}>{notice.error}</div>}

        <div className="grid-2" style={{ alignItems: "start" }}>
        <article className="card" style={{ padding: "clamp(24px,5vw,46px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 20, flexWrap: "wrap", paddingBottom: 26, borderBottom: "1px solid var(--line)" }}>
            <div>
              <p className="eyebrow">{categoryLabel(item.category)}</p>
              <h1 className="title" style={{ margin: "10px 0 12px" }}>{item.target_expression}</h1>
              <span style={{ display: "inline-block", fontSize: 13, padding: "5px 10px", background: "#edf3ee", color: "var(--green)", borderRadius: 20 }}>{STATUS_LABELS[item.learning_status]}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn" href={`/expressions/${id}/edit`}><Edit3 size={17} />Edit</Link>
              <DeleteExpressionDialog action={remove} />
            </div>
          </div>

          {passage && (
            <div className="notice" style={{ marginTop: 22 }}>
              Original passage: <Link href={`/passages/${passage.id}`} style={{ color: "var(--green)", fontWeight: 800 }}>{passage.title}</Link>
            </div>
          )}

          <dl style={{ display: "grid", gap: 0 }}>
            {sections.map((section, index) => (
              <div key={section.label} style={{ padding: "24px 0", borderTop: index ? "1px solid var(--line)" : "none" }}>
                <dt className="label" style={{ marginBottom: 10 }}>{section.label}</dt>
                <dd style={{ whiteSpace: "pre-wrap", lineHeight: 1.85, color: section.value ? "var(--ink)" : "var(--muted)" }}>{section.value || "Not entered"}</dd>
              </div>
            ))}
          </dl>
          <p className="hint" style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
            Created: {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))} ・ Updated: {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updated_at))}
          </p>
        </article>
        <ExplanationCard explanation={explanation} normalizedExpression={item.normalized_expression} displayExpression={item.target_expression} />
        </div>
      </div>
    </AppShell>
  );
}
