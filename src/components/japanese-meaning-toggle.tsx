"use client";

import { useState } from "react";

export function JapaneseMeaningToggle({ meaning }: { meaning: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="jp-meaning">
      <button type="button" className="btn btn-soft" onClick={() => setVisible((value) => !value)}>
        {visible ? "Hide Japanese" : "Show Japanese"}
      </button>
      {visible ? <div className="jp-meaning-box">{meaning}</div> : null}
    </div>
  );
}
