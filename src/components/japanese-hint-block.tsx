export type JapaneseHint = {
  japanese: string;
  hiragana?: string | null;
  romaji?: string | null;
};

export function JapaneseHintBlock({ hint }: { hint: JapaneseHint }) {
  const hiragana = hint.hiragana?.trim();
  const romaji = hint.romaji?.trim();

  return (
    <span className="quiz-japanese-hint">
      <span className="quiz-japanese-hint-row">
        <span className="quiz-japanese-hint-label">Japanese</span>
        <span>{hint.japanese}</span>
      </span>
      {hiragana ? (
        <span className="quiz-japanese-hint-row">
          <span className="quiz-japanese-hint-label">Reading</span>
          <span>{hiragana}</span>
        </span>
      ) : null}
      {romaji ? (
        <span className="quiz-japanese-hint-row">
          <span className="quiz-japanese-hint-label">Pronunciation</span>
          <span>{romaji}</span>
        </span>
      ) : null}
    </span>
  );
}
