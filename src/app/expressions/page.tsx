import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BulkGenerateExplanationsButton } from "@/components/bulk-generate-explanations-button";
import { EmptyState, ErrorState } from "@/components/feedback-states";
import { ExpressionViewTabs } from "@/components/expression-view-tabs";
import { FavoriteButton } from "@/components/favorite-button";
import { LearningStatusSelector } from "@/components/learning-status-selector";
import { Pagination } from "@/components/pagination";
import { createClient } from "@/lib/supabase/server";
import { EXPRESSION_GROUP_LEARNING_STATUSES, EXPRESSION_GROUP_STATUS_LABELS, PAGE_SIZE, passageCategoryLabel } from "@/lib/constants";
import { expressionGroupQuerySchema } from "@/lib/validation/expression-group";
import type { ExplanationGenerationStatus, ExpressionGroupSummary, PassageExpressionCountSummary } from "@/types/database";

export const metadata: Metadata = { title: "Expressions" };

type Params = {
  view?: string;
  q?: string;
  sort?: string;
  status?: string;
  favorite?: string;
  page?: string;
  deleted?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not saved";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
}

function groupHref(normalizedExpression: string) {
  return `/expressions/group?normalized=${encodeURIComponent(normalizedExpression)}`;
}

function explanationStatusLabel(status?: ExplanationGenerationStatus) {
  if (status === "completed") return "AI explanation ready";
  if (status === "pending") return "Creating AI explanation";
  if (status === "failed") return "AI explanation failed";
  return "No AI explanation yet";
}

export default async function ExpressionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const rawParams = await searchParams;
  const queryState = expressionGroupQuerySchema.parse(rawParams);
  const page = queryState.page;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const commonParams = () => {
    const params = new URLSearchParams();
    params.set("view", queryState.view);
    if (queryState.q) params.set("q", queryState.q);
    if (queryState.sort !== "latest") params.set("sort", queryState.sort);
    if (queryState.status) params.set("status", queryState.status);
    if (queryState.favorite) params.set("favorite", "1");
    return params;
  };

  const hrefForPage = (nextPage: number) => {
    const params = commonParams();
    params.set("page", String(nextPage));
    return `/expressions?${params.toString()}`;
  };

  const sortHref = (sort: "latest" | "count") => {
    const params = commonParams();
    params.set("sort", sort);
    params.delete("page");
    return `/expressions?${params.toString()}`;
  };

  let allRows: ExpressionGroupSummary[] = [];
  let passageRows: PassageExpressionCountSummary[] = [];
  let explanationStatusByNormalized = new Map<string, ExplanationGenerationStatus>();
  let missingExplanationExpressions: string[] = [];
  let total = 0;
  let loadError: string | null = null;

  if (queryState.view === "all") {
    const { data, error } = await supabase.rpc("search_expression_groups", {
      search_term: queryState.q,
      learning_status_filter: queryState.status,
      favorite_only: queryState.favorite,
      sort_key: queryState.sort,
      page_limit: PAGE_SIZE,
      page_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) {
      console.error("search_expression_groups failed", { code: error.code, message: error.message });
      loadError = "Could not load the expression list. Please check that the SQL migration is applied.";
    } else {
      allRows = (data ?? []) as ExpressionGroupSummary[];
      total = Number(allRows[0]?.total_count ?? 0);
      const normalizedValues = allRows.map((row) => row.normalized_expression);
      if (normalizedValues.length) {
        const { data: explanationRows, error: explanationError } = await supabase.from("expression_explanations")
          .select("normalized_expression,generation_status")
          .eq("user_id", user.id)
          .in("normalized_expression", normalizedValues);
        if (explanationError) {
          console.error("expression explanation status lookup failed", { code: explanationError.code, message: explanationError.message });
        } else {
          explanationStatusByNormalized = new Map((explanationRows ?? []).map((row) => [
            row.normalized_expression as string,
            row.generation_status as ExplanationGenerationStatus,
          ]));
        }
      }
    }

    const { data: allExpressionRows, error: allExpressionError } = await supabase.from("expressions")
      .select("normalized_expression")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .limit(5000);
    if (allExpressionError) {
      console.error("bulk explanation target lookup failed", { code: allExpressionError.code, message: allExpressionError.message });
    } else {
      const allNormalizedValues = [...new Set((allExpressionRows ?? []).map((row) => row.normalized_expression as string).filter(Boolean))];
      if (allNormalizedValues.length) {
        const { data: completedRows, error: completedError } = await supabase.from("expression_explanations")
          .select("normalized_expression")
          .eq("user_id", user.id)
          .eq("generation_status", "completed")
          .in("normalized_expression", allNormalizedValues);
        if (completedError) {
          console.error("completed explanation lookup failed", { code: completedError.code, message: completedError.message });
        } else {
          const completed = new Set((completedRows ?? []).map((row) => row.normalized_expression as string));
          missingExplanationExpressions = allNormalizedValues.filter((normalized) => !completed.has(normalized));
        }
      }
    }
  } else {
    const { data, error } = await supabase.rpc("list_passages_with_expression_counts", {
      page_limit: PAGE_SIZE,
      page_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) {
      console.error("list_passages_with_expression_counts failed", { code: error.code, message: error.message });
      loadError = "Could not load expressions by passage. Please check that the SQL migration is applied.";
    } else {
      passageRows = (data ?? []) as PassageExpressionCountSummary[];
      total = Number(passageRows[0]?.total_count ?? 0);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      <div className="shell page">
        {rawParams.deleted ? <div className="notice" style={{ marginBottom: 20 }}>Memo deleted.</div> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">Saved expressions</p>
            <h1 className="title" style={{ marginTop: 9 }}>Expressions</h1>
            <p className="subtitle" style={{ marginTop: 10 }}>
              {queryState.view === "all" ? `${total} expression groups` : `${total} passages`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
            <Link className="btn" href="/expressions/words"><ListChecks size={18} />Word list</Link>
            <Link className="btn btn-primary" href="/memo/new"><Plus size={18} />Add memo</Link>
          </div>
        </div>

        <ExpressionViewTabs view={queryState.view} query={queryState.q} />

        {queryState.view === "all" ? (
          <div style={{ marginBottom: 16 }}>
            <BulkGenerateExplanationsButton normalizedExpressions={missingExplanationExpressions} />
          </div>
        ) : null}

        {queryState.view === "all" ? (
          <form className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(200px,1fr) auto auto auto auto", gap: 10, marginBottom: 20 }}>
            <input type="hidden" name="view" value="all" />
            <label style={{ position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: 13, top: 13, color: "var(--muted)" }} />
              <input className="input" name="q" defaultValue={queryState.q} placeholder="Search expression or sentence" style={{ paddingLeft: 40 }} />
            </label>
            <select className="input" name="sort" defaultValue={queryState.sort} aria-label="Sort">
              <option value="latest">Newest</option>
              <option value="count">Most saved</option>
            </select>
            <select className="input" name="status" defaultValue={queryState.status ?? ""} aria-label="Learning state">
              <option value="">All</option>
              {EXPRESSION_GROUP_LEARNING_STATUSES.map((status) => <option key={status} value={status}>{EXPRESSION_GROUP_STATUS_LABELS[status]}</option>)}
            </select>
            <label className="btn" style={{ gap: 6 }}>
              <input type="checkbox" name="favorite" value="1" defaultChecked={queryState.favorite} />
              Favorites only
            </label>
            <button className="btn">Filter</button>
          </form>
        ) : null}

        {loadError ? <ErrorState message={loadError} /> : queryState.view === "all" ? (
          allRows.length ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Link className={`btn ${queryState.sort === "latest" ? "btn-primary" : ""}`} href={sortHref("latest")}>Newest</Link>
                <Link className={`btn ${queryState.sort === "count" ? "btn-primary" : ""}`} href={sortHref("count")}>Most saved</Link>
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                {allRows.map((item, index) => (
                  <div key={item.normalized_expression} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, padding: "20px 22px", borderTop: index ? "1px solid var(--line)" : "none" }}>
                    <Link href={groupHref(item.normalized_expression)} style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: "1.15rem", overflowWrap: "anywhere" }}>{item.display_expression}</strong>
                      <p className="hint" style={{ marginTop: 8 }}>
                        Saved {item.occurrence_count} times ・ {item.passage_count} passages ・ Last: {formatDate(item.latest_created_at)}
                      </p>
                      <p className="hint" style={{ marginTop: 4 }}>{explanationStatusLabel(explanationStatusByNormalized.get(item.normalized_expression))}</p>
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
                      <LearningStatusSelector normalizedExpression={item.normalized_expression} value={item.learning_status} />
                      <FavoriteButton normalizedExpression={item.normalized_expression} isFavorite={item.is_favorite} />
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} pages={pages} hrefForPage={hrefForPage} />
            </>
          ) : (
            <EmptyState title="No results found." message="Change the search, or save a new expression." actionHref="/memo/new" actionLabel="Open Quick Memo" />
          )
        ) : passageRows.length ? (
          <>
            <div className="card" style={{ overflow: "hidden" }}>
              {passageRows.map((passage, index) => (
                <Link href={`/passages/${passage.passage_id}/expressions`} key={passage.passage_id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, padding: "20px 22px", borderTop: index ? "1px solid var(--line)" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: "1.12rem", overflowWrap: "anywhere" }}>{passage.title}</strong>
                    <p className="hint" style={{ marginTop: 8 }}>{passageCategoryLabel(passage.category)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: 800 }}>{passage.distinct_expression_count} types / {passage.total_expression_count} saves</p>
                    <p className="hint" style={{ marginTop: 8 }}>Last: {formatDate(passage.latest_expression_created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={page} pages={pages} hrefForPage={hrefForPage} />
          </>
        ) : (
          <EmptyState title="No passages with saved expressions yet." message="Save words while you read a passage, and they will show here." actionHref="/passages" actionLabel="Go to passages" />
        )}
      </div>
    </AppShell>
  );
}
