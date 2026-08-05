"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { ExplanationCard } from "@/components/explanation-card";
import { SelectablePassageContent, type SavedRange } from "@/components/selectable-passage-content";
import type { ExpressionExplanation } from "@/types/database";

export type ReadingModeExpression = {
  id: string;
  targetExpression: string;
  normalizedExpression: string;
  sourceSentence: string | null;
  explanation: ExpressionExplanation | null;
};

export type ReadingModeRange = SavedRange & {
  targetExpression: string;
  normalizedExpression: string;
};

export function PassageReadingMode({
  passageId,
  content,
  ranges,
  expressions,
}: {
  passageId: string;
  content: string;
  ranges: ReadingModeRange[];
  expressions: ReadingModeExpression[];
}) {
  const firstExpressionId = ranges[0]?.expressionId ?? expressions[0]?.id ?? null;
  const [selectedExpressionId, setSelectedExpressionId] = useState<string | null>(firstExpressionId);
  const [showSavedWords, setShowSavedWords] = useState(true);
  const [isExplanationPanelOpen, setIsExplanationPanelOpen] = useState(true);

  const expressionById = useMemo(
    () => new Map(expressions.map((expression) => [expression.id, expression])),
    [expressions],
  );
  const selectedExpression = selectedExpressionId ? expressionById.get(selectedExpressionId) ?? null : null;

  return (
    <div className="reading-mode-grid" data-panel-open={isExplanationPanelOpen ? "true" : "false"}>
      <section className="reading-mode-passage-card">
        <div className="reading-mode-section-heading">
          <div>
            <p className="label">Passage text</p>
            <p className="hint">
              {showSavedWords
                ? "Click a saved word to see its meaning on the right."
                : "Saved words are hidden. Read with no hints."}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-soft"
            aria-pressed={!showSavedWords}
            onClick={() => setShowSavedWords((value) => !value)}
          >
            {showSavedWords ? "Hide saved words" : "Show saved words"}
          </button>
        </div>
        <SelectablePassageContent
          passageId={passageId}
          content={content}
          initialRanges={ranges}
          selectedExpressionId={selectedExpressionId}
          showSavedWords={showSavedWords}
          onSelectRange={(range) => {
            setSelectedExpressionId(range.expressionId);
            setIsExplanationPanelOpen(true);
          }}
        />
      </section>

      {isExplanationPanelOpen ? (
      <aside className="reading-mode-panel" aria-label="Expression explanation panel">
        <button
          type="button"
          className="reading-mode-panel-close"
          aria-label="Close explanation panel"
          onClick={() => setIsExplanationPanelOpen(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>
        {selectedExpression ? (
          <div className="reading-mode-panel-inner">
            <div className="reading-mode-context">
              <p className="eyebrow">Selected expression</p>
              {selectedExpression.sourceSentence ? (
                <p>{selectedExpression.sourceSentence}</p>
              ) : (
                <p className="hint">No saved sentence for this expression.</p>
              )}
              <Link href={`/expressions/${selectedExpression.id}`} className="hint reading-mode-detail-link">
                Open full memo <ExternalLink size={14} />
              </Link>
            </div>
            <ExplanationCard
              explanation={selectedExpression.explanation}
              normalizedExpression={selectedExpression.normalizedExpression}
              displayExpression={selectedExpression.targetExpression}
            />
          </div>
        ) : (
          <div className="card reading-mode-empty-panel">
            <BookOpen size={28} />
            <h2>No expression selected.</h2>
            <p>Select a saved word or phrase in the passage. Its meaning will show here.</p>
          </div>
        )}
      </aside>
      ) : null}
    </div>
  );
}
