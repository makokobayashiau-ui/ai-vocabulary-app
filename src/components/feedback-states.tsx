import Link from "next/link";

export function EmptyState({ title, message, actionHref, actionLabel }: { title: string; message: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
      <p className="subtitle" style={{ margin: "10px auto 20px" }}>{message}</p>
      {actionHref && actionLabel ? <Link className="btn btn-primary" href={actionHref}>{actionLabel}</Link> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="notice notice-warn">{message}</div>;
}
