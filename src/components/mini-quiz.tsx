"use client";

import { useState } from "react";
import type { MiniQuiz as MiniQuizType } from "@/types/database";

export function MiniQuiz({ quiz }: { quiz: MiniQuizType }) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  return (
    <div className="mini-quiz-card">
      <p className="label">Quick quiz</p>
      <p className="mini-quiz-question">{quiz.question}</p>
      <div className="mini-quiz-options">
        {quiz.options.map((option, index) => {
          const correct = index === quiz.correct_answer_index;
          const picked = index === selected;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className="btn mini-quiz-option"
              disabled={answered}
              data-correct={answered && correct ? "true" : undefined}
              data-picked-wrong={answered && picked && !correct ? "true" : undefined}
              onClick={() => setSelected(index)}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="notice mini-quiz-result">
          <strong>{selected === quiz.correct_answer_index ? "Correct." : "Not correct."}</strong>
          <p>{quiz.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
