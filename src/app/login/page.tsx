import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, MailCheck } from "lucide-react";
import { login, signup } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const signupMode = params.mode === "signup";

  return (
    <main className="shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBlock: 32 }}>
      <section style={{ width: "min(100%,460px)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <BookOpen size={34} style={{ margin: "0 auto 12px", color: "var(--green)" }} />
          <p className="eyebrow">Context Words</p>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: "2rem", margin: "8px 0" }}>
            {signupMode ? "Start learning" : "Welcome back"}
          </h1>
          <p className="subtitle" style={{ margin: "auto" }}>
            Save unknown English with its context.
          </p>
        </div>
        <div className="card" style={{ padding: 30 }}>
          {params.checkEmail ? (
            <div style={{ textAlign: "center", display: "grid", gap: 14 }}>
              <MailCheck size={40} style={{ margin: "auto", color: "var(--green)" }} />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Check your email</h2>
              <p className="subtitle">
                Open the email sent to {params.checkEmail}, then press the confirmation link. After that, you can log in.
              </p>
              <a className="btn" href="/login">Go to log in</a>
            </div>
          ) : (
            <>
              {params.error && <div className="notice notice-warn" role="alert" style={{ marginBottom: 20 }}>{params.error}</div>}
              <form action={signupMode ? signup : login} style={{ display: "grid", gap: 18 }}>
                <div className="field">
                  <label className="label" htmlFor="email">Email</label>
                  <input className="input" id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="password">Password</label>
                  <input className="input" id="password" name="password" type="password" minLength={6} autoComplete={signupMode ? "new-password" : "current-password"} required />
                  <span className="hint">Use at least 6 characters.</span>
                </div>
                <button className="btn btn-primary">{signupMode ? "Create account" : "Log in"}</button>
              </form>
              <div style={{ height: 1, background: "var(--line)", margin: "24px 0" }} />
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                {signupMode ? "Already have an account?" : "New here?"}{" "}
                <a href={signupMode ? "/login" : "/login?mode=signup"} style={{ color: "var(--green)", fontWeight: 800 }}>
                  {signupMode ? "Log in" : "Sign up"}
                </a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
