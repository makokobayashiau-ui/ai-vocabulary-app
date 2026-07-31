import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, PASSAGE_CATEGORIES, passageCategoryLabel } from "@/lib/constants";
import type { Passage, PassageCategory } from "@/types/database";

export const metadata: Metadata = { title: "Passages" };

type Params = { category?: string; page?: string; deleted?: string };

export default async function PassagesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const category = PASSAGE_CATEGORIES.some((item) => item.value === params.category) ? params.category as PassageCategory : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase.from("passages").select("*", { count: "exact" })
    .eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (category) query = query.eq("category", category);

  const { data, count, error } = await query;
  const passages = (data ?? []) as Passage[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (next: number) => {
    const search = new URLSearchParams();
    if (category) search.set("category", category);
    search.set("page", String(next));
    return `/passages?${search}`;
  };

  return (
    <AppShell>
      <div className="shell page">
        {params.deleted && <div className="notice" style={{ marginBottom: 20 }}>Passage deleted. Its expressions are still saved.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, marginBottom: 26, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">Passages</p>
            <h1 className="title" style={{ marginTop: 9 }}>Passages</h1>
            <p className="subtitle" style={{ marginTop: 10 }}>{total} passages</p>
          </div>
          <Link className="btn btn-primary" href="/passages/new"><Plus size={18} />Add passage</Link>
        </div>

        <form className="card" style={{ padding: 16, display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <select className="input" name="category" defaultValue={category ?? ""} aria-label="Category" style={{ maxWidth: 280 }}>
            <option value="">All categories</option>
            {PASSAGE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="btn">Filter</button>
        </form>

        {error ? (
          <div className="notice notice-warn">Could not load passages. Please check that migration 002 is applied.</div>
        ) : passages.length ? (
          <div className="card" style={{ overflow: "hidden" }}>
            {passages.map((passage, index) => (
              <Link href={`/passages/${passage.id}`} key={passage.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 18, padding: "20px 22px", borderTop: index ? "1px solid var(--line)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "1.15rem" }}>{passage.title}</strong>
                  <p style={{ color: "var(--muted)", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{passage.content}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="hint">{passageCategoryLabel(passage.category)}</span>
                  <p className="hint" style={{ marginTop: 8 }}>{new Intl.DateTimeFormat("ja-JP").format(new Date(passage.created_at))}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <FileText size={32} style={{ margin: "0 auto 12px", color: "var(--green)" }} />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>No passages yet.</h2>
            <p className="subtitle" style={{ margin: "10px auto 20px" }}>Save a passage, then collect words and phrases from it.</p>
            <Link className="btn btn-primary" href="/passages/new">Add passage</Link>
          </div>
        )}

        {total > PAGE_SIZE && (
          <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 24 }}>
            {page > 1 ? <Link className="btn" href={pageHref(page - 1)}><ChevronLeft size={18} />Previous</Link> : <span />}
            <span className="hint">Page {page} / {pages}</span>
            {page < pages ? <Link className="btn" href={pageHref(page + 1)}>Next<ChevronRight size={18} /></Link> : <span />}
          </nav>
        )}
      </div>
    </AppShell>
  );
}
