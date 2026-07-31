"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateExpressionExplanation } from "@/actions/expression-explanations";

type BulkStatus = {
  total: number;
  current: number;
  completed: number;
  skipped: number;
  failed: number;
  running: boolean;
  done: boolean;
  firstFailure: string | null;
};

export function BulkGenerateExplanationsButton({ normalizedExpressions }: { normalizedExpressions: string[] }) {
  const router = useRouter();
  const targets = useMemo(() => [...new Set(normalizedExpressions)].filter(Boolean), [normalizedExpressions]);
  const [status, setStatus] = useState<BulkStatus>({
    total: targets.length,
    current: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    running: false,
    done: false,
    firstFailure: null,
  });

  async function runBulkGeneration() {
    if (!targets.length || status.running) return;

    let completed = 0;
    let skipped = 0;
    let failed = 0;
    let firstFailure: string | null = null;

    setStatus({ total: targets.length, current: 0, completed, skipped, failed, running: true, done: false, firstFailure });

    for (let index = 0; index < targets.length; index += 1) {
      const normalizedExpression = targets[index];
      setStatus({ total: targets.length, current: index + 1, completed, skipped, failed, running: true, done: false, firstFailure });

      try {
        const result = await generateExpressionExplanation(normalizedExpression, { force: false });
        if (result.skipped) {
          skipped += 1;
        } else if (result.success || result.status === "completed") {
          completed += 1;
        } else {
          failed += 1;
          firstFailure ??= result.debugReason ?? result.error ?? `${normalizedExpression}: failed`;
        }
      } catch (error) {
        failed += 1;
        firstFailure ??= error instanceof Error ? error.message : `${normalizedExpression}: unknown client error`;
      }

      setStatus({ total: targets.length, current: index + 1, completed, skipped, failed, running: true, done: false, firstFailure });
    }

    setStatus({ total: targets.length, current: targets.length, completed, skipped, failed, running: false, done: true, firstFailure });
    router.refresh();
  }

  return (
    <div className="bulk-ai-box">
      <button
        type="button"
        className="btn btn-primary"
        onClick={runBulkGeneration}
        disabled={!targets.length || status.running}
        aria-busy={status.running}
      >
        <Sparkles size={17} />
        {status.running ? "Creating explanations..." : "Create all AI explanations"}
      </button>
      <div className="hint" role="status">
        {targets.length ? (
          status.running || status.done ? (
            <>
              Progress: {status.current}/{status.total} ・ Created: {status.completed} ・ Skipped: {status.skipped} ・ Failed: {status.failed}
            </>
          ) : (
            <>Expressions without AI explanation: {targets.length}</>
          )
        ) : (
          <>All explanations are ready.</>
        )}
      </div>
      {process.env.NODE_ENV === "development" && status.firstFailure ? (
        <div className="notice notice-warn" role="alert">
          Dev error: {status.firstFailure}
        </div>
      ) : null}
    </div>
  );
}
