"use client";

import { BookOpen, CheckCircle2, GraduationCap, Lightbulb, Link2, PencilLine, Sparkles } from "lucide-react";
import { GenerateExplanationButton } from "@/components/generate-explanation-button";
import { JapaneseMeaningToggle } from "@/components/japanese-meaning-toggle";
import { MiniQuiz } from "@/components/mini-quiz";
import { PronunciationButton } from "@/components/pronunciation-button";
import { TranslationToggle } from "@/components/translation-toggle";
import type { ExpressionExplanation, RelatedExpression } from "@/types/database";

const EXAMPLE_LABELS = [
  { label: "Daily life", key: "Daily" },
  { label: "Work", key: "Work" },
  { label: "Study", key: "Study" },
] as const;

function AiEmptyState({
  normalizedExpression,
  title,
  description,
  buttonLabel,
  force = false,
}: {
  normalizedExpression: string;
  title: string;
  description: string;
  buttonLabel: string;
  force?: boolean;
}) {
  return (
    <section className="ai-explanation-card card">
      <div className="ai-card-header">
        <div>
          <p className="eyebrow">AI Explanation</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="ai-icon-badge" aria-hidden="true">
          <Sparkles size={20} />
        </div>
      </div>
      <GenerateExplanationButton normalizedExpression={normalizedExpression} label={buttonLabel} force={force} />
    </section>
  );
}

function ChipList({ title, items }: { title: string; items: string[] | null }) {
  if (!items?.length) return null;
  return (
    <div className="ai-section">
      <div className="ai-section-title">
        <Link2 size={17} aria-hidden="true" />
        <span>{title}</span>
      </div>
      <ul className="ai-chip-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="ai-chip">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RelatedList({ title, items }: { title: string; items: RelatedExpression[] | null }) {
  if (!items?.length) return null;
  return (
    <div className="ai-section ai-section-soft">
      <div className="ai-section-title">
        <GraduationCap size={17} aria-hidden="true" />
        <span>{title}</span>
      </div>
      <ul className="ai-related-list">
        {items.map((item, index) => (
          <li key={`${item.expression}-${index}`}>
            <span>{item.expression}</span>
            {item.japanese ? <small>{item.japanese}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExplanationCard({
  explanation,
  normalizedExpression,
  displayExpression,
}: {
  explanation: ExpressionExplanation | null;
  normalizedExpression: string;
  displayExpression: string;
}) {
  if (!explanation) {
    return (
      <AiEmptyState
        normalizedExpression={normalizedExpression}
        title="No AI explanation yet."
        description="Use your saved sentence or passage to make examples, common word pairs, and a quick quiz."
        buttonLabel="Create AI explanation"
      />
    );
  }

  if (explanation.generation_status === "pending") {
    return (
      <AiEmptyState
        normalizedExpression={normalizedExpression}
        title="Creating the AI explanation..."
        description="Please wait, then refresh the page. If it takes too long, you can try again."
        buttonLabel="Try again"
        force
      />
    );
  }

  if (explanation.generation_status === "failed") {
    return (
      <AiEmptyState
        normalizedExpression={normalizedExpression}
        title="Could not create the AI explanation."
        description="This may be a short error. Your saved expression is safe, and you can try again."
        buttonLabel="Try again"
        force
      />
    );
  }

  return (
    <section className="ai-explanation-card card">
      <div className="ai-card-header">
        <div>
          <p className="eyebrow">AI Explanation</p>
          <h2>{displayExpression}</h2>
          <div className="ai-expression-tools">
            <span className="ai-type-badge">{explanation.expression_type ?? "other"}</span>
            <PronunciationButton text={displayExpression} />
          </div>
        </div>
      </div>

      <div className="ai-main-definition">
        <div className="ai-section-title">
          <BookOpen size={17} aria-hidden="true" />
          <span>Simple English</span>
        </div>
        <p>{explanation.simple_english_explanation}</p>
      </div>

      {explanation.japanese_meaning ? (
        <div className="ai-section ai-section-soft">
          <JapaneseMeaningToggle meaning={explanation.japanese_meaning} />
        </div>
      ) : null}

      {explanation.example_sentences?.length ? (
        <div className="ai-section">
          <div className="ai-section-title">
            <GraduationCap size={17} aria-hidden="true" />
            <span>Examples</span>
          </div>
          <ul className="ai-example-list">
            {explanation.example_sentences.slice(0, 3).map((sentence, index) => {
              const label = EXAMPLE_LABELS[index] ?? { label: "Example", key: "Example" };
              return (
                <li key={`${sentence}-${index}`}>
                  <div className="ai-example-label">
                    <span>{label.label}</span>
                    <small>{label.key}</small>
                  </div>
                  <p><span className="ai-bullet" aria-hidden="true">•</span>{sentence}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ChipList title="Common word pairs" items={explanation.collocations} />

      {(explanation.synonyms?.length || explanation.antonyms?.length) ? (
        <div className="ai-related-grid">
          <RelatedList title="Similar words" items={explanation.synonyms} />
          <RelatedList title="Opposite words" items={explanation.antonyms} />
        </div>
      ) : null}

      <div className="ai-note-grid">
        {explanation.usage_notes ? (
          <div className="ai-section ai-section-soft">
            <div className="ai-section-title">
              <PencilLine size={17} aria-hidden="true" />
              <span>Usage Notes</span>
            </div>
            <p>{explanation.usage_notes}</p>
            {explanation.usage_notes_ja ? <TranslationToggle translation={explanation.usage_notes_ja} /> : null}
          </div>
        ) : null}

        {explanation.mnemonic ? (
          <div className="ai-section ai-section-soft">
            <div className="ai-section-title">
              <Lightbulb size={17} aria-hidden="true" />
              <span>Mnemonic</span>
            </div>
            <p>{explanation.mnemonic}</p>
            {explanation.mnemonic_ja ? <TranslationToggle translation={explanation.mnemonic_ja} /> : null}
          </div>
        ) : null}
      </div>

      {explanation.mini_quiz ? (
        <div className="ai-quiz-wrap">
          <MiniQuiz quiz={explanation.mini_quiz} />
        </div>
      ) : null}

      <div className="ai-card-footer">
        <div className="ai-footnote">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>This is the main meaning for this expression. The meaning can change in a different context.</span>
        </div>
        <GenerateExplanationButton
          normalizedExpression={normalizedExpression}
          label="Create again"
          force
          variant="secondary"
          confirmBeforeRun
        />
      </div>
    </section>
  );
}
