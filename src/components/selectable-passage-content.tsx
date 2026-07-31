"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createExpressionFromSelection } from "@/actions/expressions";

export type SavedRange = {
  expressionId: string;
  selectionStart: number;
  selectionEnd: number;
  occurrenceCount: number | null;
};

type SelectionRange = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  top: number;
  left: number;
};

type Segment =
  | { type: "text"; key: string; text: string; start: number; end: number; active: null }
  | { type: "mark"; key: string; text: string; start: number; end: number; active: SavedRange };

type DebugState = {
  lastStep: string;
  lastSelectionEvent: string | null;
  lastSelectionClearReason: string | null;
  lastSubmittedSelection: SelectionRange | null;
  lastActionResult: unknown;
  submitStarted: boolean;
  submitBlockedReason: string | null;
};

function toCodePoints(value: string) {
  return Array.from(value);
}

function codePointLength(value: string) {
  return toCodePoints(value).length;
}

function sliceCodePoints(value: string, start: number, end: number) {
  return toCodePoints(value).slice(start, end).join("");
}

function trimSelection(content: string, start: number, end: number) {
  const characters = toCodePoints(content);
  let nextStart = start;
  let nextEnd = end;
  while (nextStart < nextEnd && /\s/.test(characters[nextStart] ?? "")) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(characters[nextEnd - 1] ?? "")) nextEnd -= 1;
  return { start: nextStart, end: nextEnd, text: characters.slice(nextStart, nextEnd).join("") };
}

function colorClass(count: number | null) {
  if (count === null) return "selection-mark selection-mark-unknown";
  if (count <= 1) return "selection-mark selection-mark-1";
  if (count === 2) return "selection-mark selection-mark-2";
  return "selection-mark selection-mark-3";
}

function countLabel(count: number | null) {
  return count === null ? "Could not check the count" : `Saved ${count} times`;
}

function buildSegments(content: string, ranges: SavedRange[]) {
  const contentLength = codePointLength(content);
  const indexedRanges = ranges.map((range, index) => ({ range, index }));
  const boundaries = Array.from(new Set([
    0,
    contentLength,
    ...ranges.flatMap((range) => [
      Math.max(0, Math.min(contentLength, range.selectionStart)),
      Math.max(0, Math.min(contentLength, range.selectionEnd)),
    ]),
  ])).sort((a, b) => a - b);
  const segments: Segment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === end) continue;

    const active = indexedRanges
      .filter(({ range }) => range.selectionStart <= start && end <= range.selectionEnd)
      .sort((a, b) => b.index - a.index)[0];

    if (!active) {
      segments.push({ type: "text", key: `text-${start}-${end}`, text: sliceCodePoints(content, start, end), start, end, active: null });
      continue;
    }

    segments.push({
      type: "mark",
      key: `mark-${active.range.expressionId}-${start}-${end}`,
      text: sliceCodePoints(content, start, end),
      start,
      end,
      active: active.range,
    });
  }

  return segments.length ? segments : [{ type: "text" as const, key: "text-empty", text: content, start: 0, end: contentLength, active: null }];
}

export function SelectablePassageContent({
  passageId,
  content,
  initialRanges = [],
  selectedExpressionId = null,
  showSavedWords = true,
  onSelectRange,
}: {
  passageId: string;
  content: string;
  initialRanges?: SavedRange[];
  selectedExpressionId?: string | null;
  showSavedWords?: boolean;
  onSelectRange?: (range: SavedRange) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [pendingSelection, setPendingSelection] = useState<SelectionRange | null>(null);
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>(initialRanges);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugState, setDebugState] = useState<DebugState>({
    lastStep: "mounted",
    lastSelectionEvent: null,
    lastSelectionClearReason: null,
    lastSubmittedSelection: null,
    lastActionResult: null,
    submitStarted: false,
    submitBlockedReason: null,
  });
  const [isPending, startTransition] = useTransition();

  const segments = useMemo(() => buildSegments(content, savedRanges), [content, savedRanges]);

  function selectionIsInsideContent(selected: Selection) {
    const container = contentRef.current;
    if (!container || selected.rangeCount === 0 || selected.isCollapsed) return false;
    const range = selected.getRangeAt(0);
    return container.contains(range.commonAncestorContainer);
  }

  function updateSelection(eventName: string) {
    const container = contentRef.current;
    const selected = window.getSelection();
    setDebugState((debug) => ({ ...debug, lastSelectionEvent: eventName, lastSelectionClearReason: null }));

    if (!container || !selected || selected.rangeCount === 0 || selected.isCollapsed) {
      setDebugState((debug) => ({ ...debug, lastStep: "dom-selection-empty-kept-pending", lastSelectionClearReason: "dom-selection-collapsed-but-pending-kept" }));
      return;
    }

    const range = selected.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setDebugState((debug) => ({ ...debug, lastStep: "dom-selection-outside-kept-pending", lastSelectionClearReason: "outside-selection-ignored" }));
      return;
    }

    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = codePointLength(preRange.toString());
    const end = start + codePointLength(range.toString());
    const trimmed = trimSelection(content, start, end);

    if (!trimmed.text || codePointLength(trimmed.text) > 300 || sliceCodePoints(content, trimmed.start, trimmed.end) !== trimmed.text) {
      setDebugState((debug) => ({ ...debug, lastStep: "dom-selection-invalid-kept-pending", lastSelectionClearReason: "invalid-selection-ignored" }));
      return;
    }

    const rect = range.getBoundingClientRect();
    setPendingSelection({
      text: trimmed.text,
      selectionStart: trimmed.start,
      selectionEnd: trimmed.end,
      top: Math.max(12, rect.top - 52),
      left: Math.min(window.innerWidth - 180, Math.max(12, rect.left)),
    });
    setDebugState((debug) => ({ ...debug, lastStep: "selection-ready", lastSelectionClearReason: null }));
    setError(null);
  }

  function clearDomSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function clearPendingSelection(reason: string) {
    setPendingSelection(null);
    setDebugState((debug) => ({ ...debug, lastSelectionClearReason: reason }));
  }

  function saveSelection() {
    if (!pendingSelection) {
      setDebugState((debug) => ({ ...debug, submitBlockedReason: "no-pending-selection", lastStep: "submit-blocked" }));
      return;
    }
    if (isPending || submittingRef.current) {
      setDebugState((debug) => ({ ...debug, submitBlockedReason: "already-submitting", lastStep: "submit-blocked" }));
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    const currentSelection = pendingSelection;
    setError(null);
    setMessage(null);
    setDebugState((debug) => ({
      ...debug,
      lastStep: "saveSelection-called",
      lastSubmittedSelection: currentSelection,
      submitStarted: true,
      submitBlockedReason: null,
    }));

    startTransition(async () => {
      try {
        setDebugState((debug) => ({ ...debug, lastStep: "server-action-started" }));
        const result = await createExpressionFromSelection(
          passageId,
          currentSelection.text,
          currentSelection.selectionStart,
          currentSelection.selectionEnd,
        );
        setDebugState((debug) => ({ ...debug, lastStep: "server-action-finished", lastActionResult: result }));

        if (!result.success || !result.expressionId) {
          setError(result.error ?? "Could not save.");
          setDebugState((debug) => ({ ...debug, lastStep: "server-action-failed" }));
          return;
        }

        const expressionId = result.expressionId;
        const occurrenceCount = result.occurrenceCount ?? null;
        setSavedRanges((ranges) => [
          ...ranges,
          {
            expressionId,
            selectionStart: currentSelection.selectionStart,
            selectionEnd: currentSelection.selectionEnd,
            occurrenceCount,
          },
        ]);
        setDebugState((debug) => ({ ...debug, lastStep: "saved-range-added" }));
        setMessage(result.message ?? (occurrenceCount === null ? "Saved. Could not check the count." : `Saved. You have saved this expression ${occurrenceCount} times.`));
        clearDomSelection();
        clearPendingSelection("submit-success");
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    });
  }

  useEffect(() => {
    function handleSelectionChange() {
      const selected = window.getSelection();
      if (!selected || selected.rangeCount === 0 || selected.isCollapsed) {
        setDebugState((debug) => ({ ...debug, lastSelectionEvent: "selectionchange", lastStep: "selectionchange-collapsed-kept-pending", lastSelectionClearReason: "collapsed-kept-pending" }));
        return;
      }
      if (!selectionIsInsideContent(selected)) {
        setDebugState((debug) => ({ ...debug, lastSelectionEvent: "selectionchange", lastStep: "selectionchange-outside-kept-pending", lastSelectionClearReason: "outside-kept-pending" }));
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  return (
    <div className="selectable-passage-wrap">
      <div className="hint" style={{ marginBottom: 10 }}>
        Select a word or phrase in the passage, then press “I don’t know.” Saved words are marked with color.
      </div>
      {message && <div className="notice" role="status" style={{ marginBottom: 12 }}>{message}</div>}
      {error && <div className="notice notice-warn" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <div
        ref={contentRef}
        className="selectable-passage"
        onMouseUp={() => updateSelection("mouseup")}
        onTouchEnd={() => window.setTimeout(() => updateSelection("touchend"), 0)}
        onKeyUp={() => updateSelection("keyup")}
        tabIndex={0}
        aria-label="Passage text. You can select a word or phrase and save it."
      >
        {segments.map((segment) => {
          if (segment.type === "text") return <span key={segment.key}>{segment.text}</span>;
          if (!showSavedWords) return <span key={segment.key}>{segment.text}</span>;
          const title = countLabel(segment.active.occurrenceCount);
          const className = `${colorClass(segment.active.occurrenceCount)}${segment.active.expressionId === selectedExpressionId ? " selection-mark-active" : ""}`;
          if (onSelectRange) {
            return (
              <button
                type="button"
                key={segment.key}
                className={className}
                aria-label={`${segment.text}. ${title}. Show meaning.`}
                title={title}
                onClick={() => onSelectRange(segment.active)}
              >
                {segment.text}
              </button>
            );
          }
          return (
            <Link
              href={`/expressions/${segment.active.expressionId}`}
              key={segment.key}
              className={className}
              aria-label={`${segment.text}. ${title}. Open details.`}
              title={title}
            >
              {segment.text}
            </Link>
          );
        })}
      </div>
      {pendingSelection && (
        <div className="selection-popover" style={{ top: pendingSelection.top, left: pendingSelection.left }}>
          <div className="hint" style={{ marginBottom: 8, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pendingSelection.text}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={isPending || isSubmitting}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={saveSelection}
            >
              {isPending || isSubmitting ? "Saving..." : "I don’t know"}
            </button>
            <button
              className="btn"
              type="button"
              disabled={isPending || isSubmitting}
              onClick={() => clearPendingSelection("manual-cancel")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {process.env.NODE_ENV === "development" && (
        <pre data-testid="selection-debug" className="selection-debug">
          {JSON.stringify(
            {
              pendingSelection,
              savedRanges,
              lastStep: debugState.lastStep,
              lastSelectionEvent: debugState.lastSelectionEvent,
              lastSelectionClearReason: debugState.lastSelectionClearReason,
              submitStarted: debugState.submitStarted,
              submitBlockedReason: debugState.submitBlockedReason,
              lastSubmittedSelection: debugState.lastSubmittedSelection,
              lastActionResult: debugState.lastActionResult,
              renderedSegments: segments.map((segment) => ({
                start: segment.start,
                end: segment.end,
                text: segment.text,
                activeExpressionId: segment.active?.expressionId ?? null,
                occurrenceCount: segment.active?.occurrenceCount ?? null,
                className: segment.active ? colorClass(segment.active.occurrenceCount) : null,
              })),
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
