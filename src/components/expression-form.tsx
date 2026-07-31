"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Save } from "lucide-react";
import { CATEGORIES, LEARNING_STATUSES, STATUS_LABELS } from "@/lib/constants";
import type { Expression } from "@/types/database";
import type { ExpressionActionState } from "@/actions/expressions";

type Action = (state: ExpressionActionState, formData: FormData) => Promise<ExpressionActionState>;

export function ExpressionForm({ action, expression, quick = false }: { action: Action; expression?: Expression; quick?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    formRef.current?.querySelector<HTMLInputElement>("[name=target_expression]")?.focus();
    const timer = window.setTimeout(() => setDuplicateCount(null), 0);
    return () => window.clearTimeout(timer);
  }, [state.success]);

  async function checkDuplicate(value: string) {
    if (!value.trim()) return setDuplicateCount(null);
    const response = await fetch(`/api/expressions/duplicates?q=${encodeURIComponent(value)}`);
    if (response.ok) setDuplicateCount((await response.json()).count ?? 0);
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="card" style={{ padding: "clamp(20px,4vw,38px)", display: "grid", gap: 24 }}>
      {state.success && (
        <div className="notice" role="status" style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <Check size={18} />
          {state.occurrenceCount ? `You have saved this expression ${state.occurrenceCount} times.` : "Saved. You can add the next expression."}
        </div>
      )}
      {state.error && <div className="notice notice-warn" role="alert">{state.error}</div>}

      <div className="field">
        <label className="label" htmlFor="target_expression">Word or phrase <span aria-hidden="true">*</span></label>
        <input className="input" id="target_expression" name="target_expression" required maxLength={300} defaultValue={expression?.target_expression} placeholder="Example: take on" onBlur={(event) => checkDuplicate(event.target.value)} autoFocus={quick} />
        {errors.target_expression?.map((error) => <span className="error" key={error}>{error}</span>)}
        {duplicateCount === 0 && <span className="hint">This is your first time saving this expression.</span>}
        {duplicateCount !== null && duplicateCount > 0 && (
          <div className="notice notice-warn">You saved this expression {duplicateCount} times before. You can save it again if the meaning is different here.</div>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="source_sentence">Sentence where you found it <span className="hint">(optional, but helpful)</span></label>
        <textarea className="input" id="source_sentence" name="source_sentence" rows={3} maxLength={5000} defaultValue={expression?.source_sentence ?? ""} placeholder="She decided to take on more responsibility." />
        {errors.source_sentence?.map((error) => <span className="error" key={error}>{error}</span>)}
      </div>

      <div className="field">
        <label className="label" htmlFor="source_passage">Text around it <span className="hint">(optional)</span></label>
        <textarea className="input" id="source_passage" name="source_passage" rows={6} maxLength={30000} defaultValue={expression?.source_passage ?? ""} placeholder="Paste the part that helps you understand this expression." />
        <span className="hint">Save only the useful part, not the whole article. Max 30,000 characters.</span>
        {errors.source_passage?.map((error) => <span className="error" key={error}>{error}</span>)}
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="source_title">Source title <span className="hint">(optional)</span></label>
          <input className="input" id="source_title" name="source_title" maxLength={500} defaultValue={expression?.source_title ?? ""} placeholder="Article or lesson title" />
        </div>
        <div className="field">
          <label className="label" htmlFor="category">Category</label>
          <select className="input" id="category" name="category" defaultValue={expression?.category ?? "other"}>
            {CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="user_memo">My note <span className="hint">(optional)</span></label>
        <textarea className="input" id="user_memo" name="user_memo" rows={3} maxLength={3000} defaultValue={expression?.user_memo ?? ""} />
      </div>

      {expression && (
        <div className="field">
          <label className="label" htmlFor="learning_status">Learning state</label>
          <select className="input" id="learning_status" name="learning_status" defaultValue={expression.learning_status}>
            {LEARNING_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </div>
      )}

      <button className="btn btn-primary" disabled={pending} style={{ justifySelf: "start", minWidth: 150 }}>
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />} {expression ? "Save changes" : "Save memo"}
      </button>
    </form>
  );
}
