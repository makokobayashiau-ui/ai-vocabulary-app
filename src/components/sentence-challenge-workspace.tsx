"use client";

import { useState, useTransition } from "react";
import {
  createSentenceChallenge,
  reviewFinalSentenceTranslation,
  reviewFirstSentenceTranslation,
  type FinalSentenceReview,
  type FirstSentenceReview,
  type SentenceChallenge,
} from "@/actions/sentence-challenge";

type Step = "start" | "translate" | "first-review" | "final-review";

function ScorePill({ label, value }: { label: string; value: string }) {
  return <span className="sentence-score-pill"><strong>{label}:</strong> {value}</span>;
}

export function SentenceChallengeWorkspace({ passageId }: { passageId: string }) {
  const [challenge, setChallenge] = useState<SentenceChallenge | null>(null);
  const [firstAnswer, setFirstAnswer] = useState("");
  const [secondAnswer, setSecondAnswer] = useState("");
  const [firstReview, setFirstReview] = useState<FirstSentenceReview | null>(null);
  const [finalReview, setFinalReview] = useState<FinalSentenceReview | null>(null);
  const [openHints, setOpenHints] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>("start");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startChallenge() {
    setError(null);
    startTransition(async () => {
      const result = await createSentenceChallenge(passageId);
      if (!result.success || !result.data) {
        setError(result.error ?? "Could not create a sentence challenge.");
        return;
      }
      setChallenge(result.data);
      setFirstAnswer("");
      setSecondAnswer("");
      setFirstReview(null);
      setFinalReview(null);
      setOpenHints(new Set());
      setStep("translate");
    });
  }

  function checkFirstAnswer() {
    if (!challenge) return;
    setError(null);
    startTransition(async () => {
      const result = await reviewFirstSentenceTranslation(passageId, challenge.sentence, challenge.focus_points, firstAnswer);
      if (!result.success || !result.data) {
        setError(result.error ?? "Could not check your translation.");
        return;
      }
      setFirstReview(result.data);
      setSecondAnswer(firstAnswer);
      setStep("first-review");
    });
  }

  function finishReview() {
    if (!challenge) return;
    setError(null);
    startTransition(async () => {
      const result = await reviewFinalSentenceTranslation(passageId, challenge.sentence, challenge.focus_points, firstAnswer, secondAnswer);
      if (!result.success || !result.data) {
        setError(result.error ?? "Could not finish the review.");
        return;
      }
      setFinalReview(result.data);
      setStep("final-review");
    });
  }

  function toggleHint(expression: string) {
    setOpenHints((current) => {
      const next = new Set(current);
      if (next.has(expression)) next.delete(expression);
      else next.add(expression);
      return next;
    });
  }

  return (
    <div className="sentence-challenge">
      {error ? <div className="notice notice-warn" role="alert">{error}</div> : null}

      {step === "start" || !challenge ? (
        <div className="card sentence-challenge-card">
          <p className="eyebrow">Sentence Challenge</p>
          <h1 className="title sentence-challenge-title">Understand one important sentence</h1>
          <p className="subtitle">
            AI will choose one useful sentence from this passage. Translate it into natural Japanese, then improve your answer with hints.
          </p>
          <button type="button" className="btn btn-primary" onClick={startChallenge} disabled={isPending}>
            {isPending ? "Creating..." : "Create challenge"}
          </button>
        </div>
      ) : null}

      {challenge && step !== "start" ? (
        <div className="card sentence-challenge-card">
          <p className="eyebrow">Translate this sentence into natural Japanese</p>
          <blockquote className="sentence-challenge-quote">“{challenge.sentence}”</blockquote>
          <p className="hint">{challenge.reason}</p>
        </div>
      ) : null}

      {challenge && step === "translate" ? (
        <div className="card sentence-challenge-card">
          <label className="field">
            <span className="label">Your Japanese translation</span>
            <textarea
              className="input sentence-challenge-textarea"
              value={firstAnswer}
              onChange={(event) => setFirstAnswer(event.target.value)}
              placeholder="Type your Japanese translation here."
            />
          </label>
          <div className="sentence-challenge-actions">
            <button type="button" className="btn btn-primary" onClick={checkFirstAnswer} disabled={isPending || !firstAnswer.trim()}>
              {isPending ? "Checking..." : "Check my translation"}
            </button>
          </div>
        </div>
      ) : null}

      {challenge && firstReview && step === "first-review" ? (
        <>
          <div className="card sentence-challenge-card">
            <h2>{firstReview.summary}</h2>
            <p>{firstReview.guidance}</p>
            {firstReview.misunderstood_expressions.length ? (
              <>
                <p className="label">Please think again about:</p>
                <ul className="sentence-focus-list">
                  {firstReview.misunderstood_expressions.map((expression) => <li key={expression}>{expression}</li>)}
                </ul>
              </>
            ) : null}
          </div>

          <div className="card sentence-challenge-card">
            <h2>Hints</h2>
            <div className="sentence-hint-list">
              {challenge.focus_points.map((point) => {
                const open = openHints.has(point.expression);
                return (
                  <div key={point.expression} className="sentence-hint-item">
                    <button type="button" className="btn btn-soft" aria-expanded={open} onClick={() => toggleHint(point.expression)}>
                      {point.expression}
                    </button>
                    {open ? (
                      <div className="sentence-hint-body">
                        <p>{point.hint_english}</p>
                        {point.hint_japanese ? <p className="hint">{point.hint_japanese}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card sentence-challenge-card">
            <h2>Try again.</h2>
            <label className="field">
              <span className="label">Your second translation</span>
              <textarea
                className="input sentence-challenge-textarea"
                value={secondAnswer}
                onChange={(event) => setSecondAnswer(event.target.value)}
              />
            </label>
            <div className="sentence-challenge-actions">
              <button type="button" className="btn btn-primary" onClick={finishReview} disabled={isPending || !secondAnswer.trim()}>
                {isPending ? "Reviewing..." : "Final review"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {challenge && finalReview && step === "final-review" ? (
        <div className="card sentence-challenge-card">
          <h2>Final review</h2>
          <div className="sentence-answer-grid">
            <div>
              <p className="label">Your first answer</p>
              <p>{firstAnswer}</p>
            </div>
            <div>
              <p className="label">Your second answer</p>
              <p>{secondAnswer}</p>
            </div>
          </div>
          <div className="sentence-suggested">
            <p className="label">Suggested translation</p>
            <p>{finalReview.suggested_translation}</p>
          </div>
          <div>
            <p className="label">Important points</p>
            <ul className="sentence-point-list">
              {finalReview.important_points.map((point) => (
                <li key={point.expression}>
                  <strong>{point.status === "understood" ? "✓" : point.status === "partly_understood" ? "△" : "•"} {point.expression}</strong>
                  <p>{point.feedback}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="sentence-score-row">
            <ScorePill label="Meaning" value={finalReview.meaning_score} />
            <ScorePill label="Grammar" value={finalReview.grammar_score} />
            <ScorePill label="Expressions" value={`${finalReview.expressions_understood.understood} / ${finalReview.expressions_understood.total} understood`} />
          </div>
          <div className="notice">
            <p>{finalReview.overall}</p>
            {finalReview.savedExpressions ? <p className="hint">{finalReview.savedExpressions} expression(s) saved for review.</p> : null}
          </div>
          <div className="sentence-challenge-actions">
            <button type="button" className="btn" onClick={startChallenge} disabled={isPending}>
              Try another sentence
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
