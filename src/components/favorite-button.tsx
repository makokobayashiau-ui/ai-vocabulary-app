"use client";

import { useState, useTransition } from "react";
import { toggleExpressionFavorite } from "@/actions/expression-learning";

export function FavoriteButton({ normalizedExpression, isFavorite }: { normalizedExpression: string; isFavorite: boolean }) {
  const [current, setCurrent] = useState(isFavorite);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ display: "inline-grid", gap: 5 }}>
      <button
        type="button"
        className="btn"
        disabled={isPending}
        aria-pressed={current}
        aria-label={current ? "Remove from favorites" : "Add to favorites"}
        onClick={() => {
          const next = !current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await toggleExpressionFavorite(normalizedExpression, next);
            if (result.error) {
              setCurrent(!next);
              setError(result.error);
            }
          });
        }}
      >
        <span aria-hidden>{current ? "⭐" : "☆"}</span>
        {current ? "Favorite" : "Favorite"}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
