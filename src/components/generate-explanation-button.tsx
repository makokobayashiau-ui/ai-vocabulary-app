"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { generateExpressionExplanation } from "@/actions/expression-explanations";

export function GenerateExplanationButton({
  normalizedExpression,
  label = "Create AI explanation",
  force = false,
  variant = "primary",
  confirmBeforeRun = false,
}: {
  normalizedExpression: string;
  label?: string;
  force?: boolean;
  variant?: "primary" | "secondary";
  confirmBeforeRun?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function onClick() {
    if (confirmBeforeRun && !confirming) {
      setMessage("Press again to replace it with a new explanation.");
      setConfirming(true);
      return;
    }

    setMessage(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await generateExpressionExplanation(normalizedExpression, { force });
      if (result.success) {
        router.refresh();
        return;
      }
      setMessage(result.error ?? "Could not create the AI explanation.");
      if (result.status === "failed") router.refresh();
    });
  }

  const className = variant === "secondary" ? "btn btn-soft" : "btn btn-primary";

  return (
    <div className="ai-action">
      <button type="button" className={className} onClick={onClick} disabled={isPending} aria-busy={isPending}>
        {force ? <RefreshCw size={16} /> : <Sparkles size={17} />}
        {isPending ? "Creating..." : confirming ? "Press again to create" : label}
      </button>
      {message ? <p className="hint" role="alert">{message}</p> : null}
    </div>
  );
}
