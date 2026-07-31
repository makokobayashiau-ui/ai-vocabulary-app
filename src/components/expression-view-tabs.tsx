import Link from "next/link";

export function ExpressionViewTabs({ view, query }: { view: "all" | "passages"; query: string }) {
  const base = new URLSearchParams();
  if (query) base.set("q", query);
  const href = (nextView: "all" | "passages") => {
    const params = new URLSearchParams(base);
    params.set("view", nextView);
    return `/expressions?${params.toString()}`;
  };

  return (
    <div className="card" style={{ padding: 6, display: "inline-flex", gap: 6, marginBottom: 18 }}>
      <Link className={`btn ${view === "all" ? "btn-primary" : ""}`} href={href("all")}>All expressions</Link>
      <Link className={`btn ${view === "passages" ? "btn-primary" : ""}`} href={href("passages")}>By passage</Link>
    </div>
  );
}
