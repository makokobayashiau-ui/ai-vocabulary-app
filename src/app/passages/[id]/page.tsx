import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleHelp, Edit3, ListChecks, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeletePassageDialog } from "@/components/delete-passage-dialog";
import { PassageReadingMode, type ReadingModeExpression, type ReadingModeRange } from "@/components/passage-reading-mode";
import { deletePassage } from "@/actions/passages";
import { asSafeExpressionExplanation } from "@/lib/expression-explanation-utils";
import { createClient } from "@/lib/supabase/server";
import { passageCategoryLabel } from "@/lib/constants";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Expression, ExpressionExplanation, Passage } from "@/types/database";

type Params = { updated?: string; error?: string };

export default async function PassageDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();
  const notice = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: passageData } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!passageData) notFound();
  const passage = passageData as Passage;
  const remove = deletePassage.bind(null, id);
  const { data: selectionData, error: selectionError } = await supabase.from("expressions")
    .select("id,target_expression,normalized_expression,source_sentence,selection_start,selection_end,created_at")
    .eq("user_id", user.id)
    .eq("passage_id", passage.id)
    .is("deleted_at", null)
    .not("selection_start", "is", null)
    .not("selection_end", "is", null)
    .order("created_at", { ascending: true });

  if (selectionError) {
    console.error("Failed to load saved selection ranges", { code: selectionError.code, message: selectionError.message });
  }

  const selectedExpressions = (selectionData ?? []) as Pick<Expression, "id" | "target_expression" | "normalized_expression" | "source_sentence" | "selection_start" | "selection_end" | "created_at">[];
  const normalizedValues = [...new Set(selectedExpressions.map((expression) => expression.normalized_expression))];
  const [{ data: occurrenceData, error: occurrenceError }, { data: explanationData, error: explanationError }] = normalizedValues.length
    ? await Promise.all([
      supabase.from("expressions")
        .select("normalized_expression")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("normalized_expression", normalizedValues),
      supabase.from("expression_explanations")
        .select("*")
        .eq("user_id", user.id)
        .in("normalized_expression", normalizedValues),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (occurrenceError) {
    console.error("Failed to load expression occurrence counts for selection ranges", { code: occurrenceError.code, message: occurrenceError.message });
  }
  if (explanationError) {
    console.error("Failed to load explanations for passage reading mode", { code: explanationError.code, message: explanationError.message });
  }

  const occurrenceCounts = new Map<string, number>();
  for (const row of occurrenceData ?? []) {
    const normalized = row.normalized_expression as string;
    occurrenceCounts.set(normalized, (occurrenceCounts.get(normalized) ?? 0) + 1);
  }
  const explanationByNormalized = new Map(
    ((explanationData ?? []) as ExpressionExplanation[]).map((explanation) => [
      explanation.normalized_expression,
      asSafeExpressionExplanation(explanation),
    ]),
  );
  const initialRanges: ReadingModeRange[] = selectedExpressions
    .filter((expression) => expression.selection_start !== null && expression.selection_end !== null)
    .map((expression) => ({
      expressionId: expression.id,
      selectionStart: expression.selection_start as number,
      selectionEnd: expression.selection_end as number,
      occurrenceCount: occurrenceCounts.get(expression.normalized_expression) ?? null,
      targetExpression: expression.target_expression,
      normalizedExpression: expression.normalized_expression,
      createdAt: expression.created_at,
    }));
  const readingExpressions: ReadingModeExpression[] = selectedExpressions.map((expression) => ({
    id: expression.id,
    targetExpression: expression.target_expression,
    normalizedExpression: expression.normalized_expression,
    sourceSentence: expression.source_sentence,
    explanation: explanationByNormalized.get(expression.normalized_expression) ?? null,
  }));

  return (
    <AppShell>
      <div className="shell page passage-reading-shell">
        <Link href="/passages" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passages
        </Link>
        {notice.updated && <div className="notice" style={{ marginBottom: 18 }}>Changes saved.</div>}
        {notice.error && <div className="notice notice-warn" style={{ marginBottom: 18 }}>{notice.error}</div>}

        <article className="card" style={{ padding: "clamp(24px,5vw,46px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 20, flexWrap: "wrap", paddingBottom: 26, borderBottom: "1px solid var(--line)" }}>
            <div>
              <p className="eyebrow">{passageCategoryLabel(passage.category)}</p>
              <h1 className="title" style={{ margin: "10px 0 12px" }}>{passage.title}</h1>
              {passage.source_url && <a href={passage.source_url} target="_blank" rel="noreferrer" className="hint">{passage.source_url}</a>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/passages/${id}/expressions`}><ListChecks size={17} />View saved expressions</Link>
              <Link className="btn btn-soft" href={`/passages/${id}/quiz`}><CircleHelp size={17} />Start quiz</Link>
              <Link className="btn btn-primary" href={`/passages/${id}/expressions/new`}><Plus size={17} />Add expression</Link>
              <Link className="btn" href={`/passages/${id}/edit`}><Edit3 size={17} />Edit</Link>
              <DeletePassageDialog action={remove} />
            </div>
          </div>

          <section style={{ padding: "24px 0" }}>
            <PassageReadingMode
              passageId={passage.id}
              content={passage.content}
              ranges={initialRanges}
              expressions={readingExpressions}
            />
          </section>
        </article>
      </div>
    </AppShell>
  );
}
