import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExplanationCard } from "@/components/explanation-card";
import { FavoriteButton } from "@/components/favorite-button";
import { LearningStatusSelector } from "@/components/learning-status-selector";
import { createClient } from "@/lib/supabase/server";
import { EXPRESSION_GROUP_STATUS_LABELS, passageCategoryLabel } from "@/lib/constants";
import { normalizedExpressionSchema } from "@/lib/validation/expression-group";
import { miniQuizSchema, relatedExpressionSchema } from "@/lib/validation/explanation";
import type { Expression, ExpressionExplanation, ExpressionLearningState, Passage } from "@/types/database";

type Params = { normalized?: string };

type Context = Expression & {
  passage_title: string | null;
  passage_category: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

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

export default async function ExpressionGroupDetail({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const parsed = normalizedExpressionSchema.safeParse(params.normalized ?? "");
  if (!parsed.success) notFound();
  const normalized = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: expressionData, error: expressionError } = await supabase.from("expressions").select("*")
    .eq("user_id", user.id)
    .eq("normalized_expression", normalized)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (expressionError) {
    console.error("Failed to load expression group contexts", { code: expressionError.code, message: expressionError.message });
    notFound();
  }

  const expressions = (expressionData ?? []) as Expression[];
  if (!expressions.length) notFound();

  const passageIds = [...new Set(expressions.map((item) => item.passage_id).filter((value): value is string => Boolean(value)))];
  const { data: passageData } = passageIds.length
    ? await supabase.from("passages").select("id,title,category")
      .in("id", passageIds)
      .eq("user_id", user.id)
      .is("deleted_at", null)
    : { data: [] };
  const passageById = new Map(((passageData ?? []) as Pick<Passage, "id" | "title" | "category">[]).map((passage) => [passage.id, passage]));

  const contexts: Context[] = expressions.map((expression) => {
    const passage = expression.passage_id ? passageById.get(expression.passage_id) : null;
    return {
      ...expression,
      passage_title: passage?.title ?? null,
      passage_category: passage?.category ?? null,
    };
  });

  const displayExpression = expressions[0].target_expression;
  const occurrenceCount = expressions.length;
  const passageCount = new Set(contexts.filter((item) => item.passage_title).map((item) => item.passage_id)).size;

  const { data: stateData } = await supabase.from("expression_learning_states").select("*")
    .eq("user_id", user.id)
    .eq("normalized_expression", normalized)
    .maybeSingle();
  const learningState = stateData as ExpressionLearningState | null;

  const { data: explanationData } = await supabase.from("expression_explanations").select("*")
    .eq("user_id", user.id)
    .eq("normalized_expression", normalized)
    .maybeSingle();
  const explanation = asExplanation(explanationData);

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 980 }}>
        <Link href="/expressions" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to expressions
        </Link>

        <section className="card" style={{ padding: "clamp(24px,5vw,44px)", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 18, flexWrap: "wrap" }}>
            <div>
              <p className="eyebrow">Expression group</p>
              <h1 className="title" style={{ margin: "10px 0 12px", overflowWrap: "anywhere" }}>{displayExpression}</h1>
              <p className="subtitle">normalized: {normalized}</p>
              <p className="hint" style={{ marginTop: 10 }}>
                Saved {occurrenceCount} times ・ {passageCount} passages ・ Learning state: {EXPRESSION_GROUP_STATUS_LABELS[learningState?.learning_status ?? "new"]}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
              <LearningStatusSelector normalizedExpression={normalized} value={learningState?.learning_status ?? "new"} />
              <FavoriteButton normalizedExpression={normalized} isFavorite={learningState?.is_favorite ?? false} />
            </div>
          </div>
        </section>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <ExplanationCard explanation={explanation} normalizedExpression={normalized} displayExpression={displayExpression} />

          <section className="card" style={{ padding: "clamp(20px,4vw,32px)" }}>
            <p className="eyebrow">Saved contexts</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: 8 }}>Saved contexts</h2>
            <p className="subtitle" style={{ marginTop: 10 }}>These are the places and dates where you saved this expression. Quick Memo means there is no passage.</p>
            <div className="notice notice-warn" style={{ marginTop: 16 }}>
              This explanation shows the main meaning for this expression. The meaning can change in a different context.
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {contexts.map((context) => (
                <article key={context.id} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      {context.passage_id && context.passage_title ? (
                        <Link href={`/passages/${context.passage_id}`} style={{ color: "var(--green)", fontWeight: 800 }}>{context.passage_title}</Link>
                      ) : (
                        <strong>{context.passage_id ? "Deleted passage" : "Quick Memo"}</strong>
                      )}
                      {context.passage_category ? <p className="hint" style={{ marginTop: 4 }}>{passageCategoryLabel(context.passage_category)}</p> : null}
                    </div>
                    <p className="hint">{formatDateTime(context.created_at)}</p>
                  </div>
                  <p style={{ marginTop: 10, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                    {context.source_sentence || context.target_expression}
                  </p>
                  {context.selection_start !== null && context.selection_end !== null ? (
                    <p className="hint" style={{ marginTop: 8 }}>Selected text: {context.selection_start}–{context.selection_end}</p>
                  ) : null}
                  <Link href={`/expressions/${context.id}`} className="hint" style={{ display: "inline-block", marginTop: 8, color: "var(--green)", fontWeight: 800 }}>Open memo</Link>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
