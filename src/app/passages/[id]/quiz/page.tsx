import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PassageVocabularyQuiz, type PassageQuizItem } from "@/components/passage-vocabulary-quiz";
import { createClient } from "@/lib/supabase/server";
import { passageCategoryLabel } from "@/lib/constants";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Expression, ExpressionExplanation, Passage } from "@/types/database";

type QuizExplanation = Pick<
  ExpressionExplanation,
  | "normalized_expression"
  | "simple_english_explanation"
  | "japanese_meaning"
  | "generation_status"
> & Partial<Pick<ExpressionExplanation, "japanese_meaning_hiragana" | "japanese_meaning_romaji">>;

function logSupabaseError(label: string, error: { message?: string; details?: string; hint?: string; code?: string }) {
  console.error(label, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

function isMissingReadingColumnError(error: { message?: string; code?: string } | null) {
  return error?.code === "PGRST204"
    && Boolean(error.message?.includes("expression_explanations"))
    && (
      Boolean(error.message?.includes("japanese_meaning_hiragana"))
      || Boolean(error.message?.includes("japanese_meaning_romaji"))
    );
}

export default async function PassageQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: passageData } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!passageData) notFound();
  const passage = passageData as Passage;

  const { data: expressionData, error: expressionError } = await supabase.from("expressions")
    .select("id,target_expression,normalized_expression,source_sentence,created_at")
    .eq("user_id", user.id)
    .eq("passage_id", passage.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (expressionError) {
    console.error("Failed to load passage quiz expressions", { code: expressionError.code, message: expressionError.message });
  }

  const expressions = (expressionData ?? []) as Pick<Expression, "id" | "target_expression" | "normalized_expression" | "source_sentence" | "created_at">[];
  const latestByNormalized = new Map<string, Pick<Expression, "id" | "target_expression" | "normalized_expression" | "source_sentence" | "created_at">>();
  for (const expression of expressions) {
    if (!latestByNormalized.has(expression.normalized_expression)) latestByNormalized.set(expression.normalized_expression, expression);
  }

  const normalizedValues = [...latestByNormalized.keys()];
  const { data: explanationDataWithReadings, error: explanationErrorWithReadings } = normalizedValues.length
    ? await supabase.from("expression_explanations")
      .select("normalized_expression,simple_english_explanation,japanese_meaning,japanese_meaning_hiragana,japanese_meaning_romaji,generation_status")
      .eq("user_id", user.id)
      .eq("generation_status", "completed")
      .in("normalized_expression", normalizedValues)
    : { data: [], error: null };

  let explanationData = explanationDataWithReadings as QuizExplanation[] | null;
  let explanationError = explanationErrorWithReadings;

  if (explanationErrorWithReadings && isMissingReadingColumnError(explanationErrorWithReadings)) {
    logSupabaseError("Failed to load passage quiz explanations with Japanese reading fields. Retrying without optional reading fields.", explanationErrorWithReadings);
    const fallback = await supabase.from("expression_explanations")
      .select("normalized_expression,simple_english_explanation,japanese_meaning,generation_status")
      .eq("user_id", user.id)
      .eq("generation_status", "completed")
      .in("normalized_expression", normalizedValues);

    explanationData = fallback.data as QuizExplanation[] | null;
    explanationError = fallback.error;
  }

  if (explanationError) {
    logSupabaseError("Failed to load passage quiz explanations", explanationError);
  }

  const explanationByNormalized = new Map((explanationData ?? []).map((explanation) => [
    explanation.normalized_expression as string,
    explanation,
  ]));

  const quizItems: PassageQuizItem[] = [...latestByNormalized.values()].flatMap((expression) => {
    const explanation = explanationByNormalized.get(expression.normalized_expression);
    if (!explanation?.simple_english_explanation && !explanation?.japanese_meaning) return [];
    return [{
      expressionId: expression.id,
      expression: expression.target_expression,
      normalizedExpression: expression.normalized_expression,
      sourceSentence: expression.source_sentence,
      simpleEnglish: explanation.simple_english_explanation ?? null,
      japaneseMeaning: explanation.japanese_meaning ?? null,
      japaneseMeaningHiragana: explanation.japanese_meaning_hiragana ?? null,
      japaneseMeaningRomaji: explanation.japanese_meaning_romaji ?? null,
    }];
  });

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 980 }}>
        <Link href={`/passages/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passage
        </Link>
        <p className="eyebrow">{passageCategoryLabel(passage.category)}</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>{passage.title}</h1>
        <p className="subtitle" style={{ marginBottom: 24 }}>
          Practice vocabulary saved from this passage.
        </p>

        <PassageVocabularyQuiz items={quizItems} savedWordCount={latestByNormalized.size} passageId={id} />
      </div>
    </AppShell>
  );
}
