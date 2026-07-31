"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { PASSAGE_CATEGORIES } from "@/lib/constants";
import type { PassageActionState } from "@/actions/passages";
import type { Passage } from "@/types/database";

type Action = (state: PassageActionState, formData: FormData) => Promise<PassageActionState>;

export function PassageForm({
  action,
  passage,
  contentLocked = false,
}: {
  action: Action;
  passage?: Passage;
  contentLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card" style={{ padding: "clamp(20px,4vw,38px)", display: "grid", gap: 22 }}>
      {state.error && <div className="notice notice-warn" role="alert">{state.error}</div>}

      <div className="field">
        <label className="label" htmlFor="title">Title <span aria-hidden="true">*</span></label>
        <input className="input" id="title" name="title" required maxLength={500} defaultValue={passage?.title ?? ""} placeholder="Article, lesson, or passage title" autoFocus={!passage} />
        {errors.title?.map((error) => <span className="error" key={error}>{error}</span>)}
      </div>

      <div className="field">
        <label className="label" htmlFor="content">Passage text <span aria-hidden="true">*</span></label>
        <textarea className="input" id="content" name="content" rows={14} required maxLength={50000} readOnly={contentLocked} defaultValue={passage?.content ?? ""} placeholder="Paste the passage here." />
        <span className="hint">Max 50,000 characters. Save the full passage here.</span>
        {contentLocked && <div className="notice notice-warn">This passage has saved expressions, so the text is locked. You can still edit the title, category, and URL.</div>}
        {errors.content?.map((error) => <span className="error" key={error}>{error}</span>)}
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="source_url">URL <span className="hint">(optional)</span></label>
          <input className="input" id="source_url" name="source_url" maxLength={2000} defaultValue={passage?.source_url ?? ""} placeholder="https://example.com/article" />
          {errors.source_url?.map((error) => <span className="error" key={error}>{error}</span>)}
        </div>
        <div className="field">
          <label className="label" htmlFor="category">Category</label>
          <select className="input" id="category" name="category" defaultValue={passage?.category ?? "other"}>
            {PASSAGE_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
          </select>
          {errors.category?.map((error) => <span className="error" key={error}>{error}</span>)}
        </div>
      </div>

      <button className="btn btn-primary" disabled={pending} style={{ justifySelf: "start", minWidth: 150 }}>
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />} {passage ? "Save changes" : "Save passage"}
      </button>
    </form>
  );
}
