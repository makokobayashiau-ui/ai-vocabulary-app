"use client";

import { useId, useState } from "react";

export function TranslationToggle({ translation }: { translation: string }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="translation-toggle">
      <button
        type="button"
        className="btn btn-soft translation-toggle-button"
        aria-expanded={visible}
        aria-controls={id}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? "Hide Japanese" : "Show Japanese"}
      </button>
      {visible ? (
        <div id={id} className="translation-box">
          {translation}
        </div>
      ) : null}
    </div>
  );
}
