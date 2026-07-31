"use client";

import { useState, useTransition } from "react";
import { updateLearningStatus } from "@/actions/expression-learning";
import { EXPRESSION_GROUP_STATUS_LABELS } from "@/lib/constants";
import type { ExpressionLearningStatus } from "@/types/database";

const statuses: ExpressionLearningStatus[] = ["new", "learning", "known"];

export function LearningStatusSelector({ normalizedExpression, value }: { normalizedExpression: string; value: ExpressionLearningStatus }) {
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select
        className="input"
        value={current}
        disabled={isPending}
        aria-label="Learning state"
        onChange={(event) => {
          const next = event.target.value as ExpressionLearningStatus;
          const previous = current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await updateLearningStatus(normalizedExpression, next);
            if (result.error) {
              setCurrent(previous);
              setError(result.error);
            }
          });
        }}
      >
        {statuses.map((status) => <option key={status} value={status}>{EXPRESSION_GROUP_STATUS_LABELS[status]}</option>)}
      </select>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
