import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pages, hrefForPage }: { page: number; pages: number; hrefForPage: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 24 }}>
      {page > 1 ? <Link className="btn" href={hrefForPage(page - 1)}><ChevronLeft size={18} />Previous</Link> : <span />}
      <span className="hint">Page {page} / {pages}</span>
      {page < pages ? <Link className="btn" href={hrefForPage(page + 1)}>Next<ChevronRight size={18} /></Link> : <span />}
    </nav>
  );
}
