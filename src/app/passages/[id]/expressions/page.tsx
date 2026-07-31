import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/feedback-states";
import { FavoriteButton } from "@/components/favorite-button";
import { LearningStatusSelector } from "@/components/learning-status-selector";
import { Pagination } from "@/components/pagination";
import { createClient } from "@/lib/supabase/server";
import { EXPRESSION_GROUP_SORTS, PAGE_SIZE, passageCategoryLabel } from "@/lib/constants";
import { pageQuerySchema, searchQuerySchema } from "@/lib/validation/expression-group";
import { passageIdSchema } from "@/lib/validation/passage";
import type { Passage, PassageExpressionGroupSummary } from "@/types/database";

type Params = { q?: string; sort?: string; page?: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "Not saved";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
}

function groupHref(normalizedExpression: string) {
  return `/expressions/group?normalized=${encodeURIComponent(normalizedExpression)}`;
}

export default async function PassageExpressionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id } = await params;
  if (!passageIdSchema.safeParse(id).success) notFound();
  const rawQuery = await searchParams;
  const search = searchQuerySchema.parse(rawQuery.q);
  const sort = EXPRESSION_GROUP_SORTS.includes(rawQuery.sort as "latest" | "count") ? rawQuery.sort as "latest" | "count" : "latest";
  const page = pageQuerySchema.parse(rawQuery.page);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: passageData } = await supabase.from("passages").select("*")
    .eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (!passageData) notFound();
  const passage = passageData as Passage;

  const { data, error } = await supabase.rpc("search_passage_expression_groups", {
    passage_id_value: id,
    search_term: search,
    sort_key: sort,
    page_limit: PAGE_SIZE,
    page_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = (data ?? []) as PassageExpressionGroupSummary[];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (sort !== "latest") next.set("sort", sort);
    next.set("page", String(nextPage));
    return `/passages/${id}/expressions?${next.toString()}`;
  };

  return (
    <AppShell>
      <div className="shell page" style={{ maxWidth: 980 }}>
        <Link href={`/passages/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", marginBottom: 25 }}>
          <ArrowLeft size={17} />Back to passage
        </Link>
        <p className="eyebrow">{passageCategoryLabel(passage.category)}</p>
        <h1 className="title" style={{ margin: "10px 0 12px" }}>Saved expressions</h1>
        <p className="subtitle" style={{ marginBottom: 24 }}>Check the expressions you saved in “{passage.title}”.</p>

        <form className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(200px,1fr) auto auto", gap: 10, marginBottom: 20 }}>
          <label style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 13, top: 13, color: "var(--muted)" }} />
            <input className="input" name="q" defaultValue={search} placeholder="Search expressions in this passage" style={{ paddingLeft: 40 }} />
          </label>
          <select className="input" name="sort" defaultValue={sort} aria-label="Sort">
            <option value="latest">Newest</option>
            <option value="count">Most saved</option>
          </select>
          <button className="btn">Filter</button>
        </form>

        <div className="card" style={{ padding: "clamp(20px,4vw,34px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Expressions in this passage</h2>
            <Link className="btn btn-primary" href={`/passages/${id}/expressions/new`}><Plus size={17} />Add expression</Link>
          </div>
          {error ? (
            <ErrorState message="Could not load the expressions for this passage. Please check that the SQL migration is applied." />
          ) : rows.length ? (
            <>
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                {rows.map((item, index) => (
                  <div key={item.normalized_expression} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, padding: "16px 18px", borderTop: index ? "1px solid var(--line)" : "none" }}>
                    <Link href={groupHref(item.normalized_expression)} style={{ minWidth: 0 }}>
                      <strong style={{ overflowWrap: "anywhere" }}>{item.display_expression}</strong>
                      <p className="hint" style={{ marginTop: 5 }}>Saved {item.occurrence_count} times ・ Last: {formatDate(item.latest_created_at)}</p>
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
            <EmptyState title="No expressions in this passage yet." message="Select text in the passage, or add an expression by hand." actionHref={`/passages/${id}/expressions/new`} actionLabel="Add expression" />
          )}
        </div>
      </div>
    </AppShell>
  );
}
