"use client";

import { useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export function DeletePassageDialog({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this passage? Its saved expressions will stay.")) return;
        startTransition(() => {
          void action();
        });
      }}
      type="button"
    >
      {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
      Delete
    </button>
  );
}
