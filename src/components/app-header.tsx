import Link from "next/link";
import { BookOpen, FileText, LogOut, Plus } from "lucide-react";
import { logout } from "@/actions/auth";

export function AppHeader() {
  return (
    <header style={{ background: "rgba(246,244,237,.92)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(12px)" }}>
      <div className="shell" style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Georgia,serif", fontWeight: 700, fontSize: "1.1rem" }}>
          <BookOpen size={21} />
          <span>Context Words</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "end" }} aria-label="Main navigation">
          <Link className="btn" href="/passages"><FileText size={17} /><span className="hidden sm:inline">Passages</span></Link>
          <Link className="btn" href="/expressions"><span className="hidden sm:inline">Expressions</span><span className="sm:hidden">List</span></Link>
          <Link className="btn btn-primary" href="/memo/new"><Plus size={18} /><span className="hidden sm:inline">Quick memo</span></Link>
          <form action={logout}><button className="btn" aria-label="Log out"><LogOut size={18} /></button></form>
        </nav>
      </div>
    </header>
  );
}
