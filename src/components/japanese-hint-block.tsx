export type JapaneseHint = {
  japanese: string;
  hiragana?: string | null;
  romaji?: string | null;
};

export function JapaneseHintBlock({ hint }: { hint: JapaneseHint }) {
  const japanese = hint.japanese.trim();
  const hiragana = hint.hiragana?.trim();
  const romaji = hint.romaji?.trim();
  const parts = [japanese, hiragana, romaji].filter((value): value is string => Boolean(value));

  return (
    <span className="quiz-japanese-hint">
      <span className="quiz-japanese-hint-row">
        <span className="quiz-japanese-hint-label">Japanese</span>
        <span className="quiz-japanese-hint-line">{parts.join(" ／ ")}</span>
      </span>
    </span>
  );
}
