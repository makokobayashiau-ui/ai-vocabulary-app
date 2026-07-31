"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { JapaneseHintBlock, type JapaneseHint } from "@/components/japanese-hint-block";
import { PronunciationButton } from "@/components/pronunciation-button";

export type PassageQuizItem = {
  expressionId: string;
  expression: string;
  normalizedExpression: string;
  sourceSentence: string | null;
  simpleEnglish: string | null;
  japaneseMeaning: string | null;
  japaneseMeaningHiragana?: string | null;
  japaneseMeaningRomaji?: string | null;
};

type QuestionCountSetting = "10" | "20" | "30" | "all";
type QuestionTypeSetting = "meaning" | "word" | "mixed";
type QuizQuestionType = "meaning" | "word";

type MeaningChoice = {
  normalizedExpression: string;
  displayExpression: string;
  english: string;
  japaneseHint: JapaneseHint | null;
};

type PassageQuizQuestion = {
  expressionId: string;
  normalizedExpression: string;
  displayExpression: string;
  sourceSentence: string | null;
  questionType: QuizQuestionType;
  englishMeaning: string;
  japaneseHint: JapaneseHint | null;
  prompt: MeaningChoice | string;
  choices: Array<MeaningChoice | string>;
  correctKey: string;
};

type QuizSession = {
  questions: PassageQuizQuestion[];
  answers: Array<string | null>;
  currentIndex: number;
  finished: boolean;
  questionCountSetting: QuestionCountSetting;
  questionTypeSetting: QuestionTypeSetting;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function uniqueByNormalized(items: PassageQuizItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.normalizedExpression)) return false;
    seen.add(item.normalizedExpression);
    return true;
  });
}

function hasEnglish(item: PassageQuizItem) {
  return Boolean(item.simpleEnglish?.trim());
}

function getShortJapaneseHint(value: string | null): string | null {
  if (!value?.trim()) return null;
  const firstPart = value
    .replace(/[。．.!！？?].*$/u, "")
    .split(/[、,，/／・;；:：()[\]（）「」『』]/u)[0]
    .trim();
  const compact = firstPart.replace(/\s+/g, "");
  if (!compact) return null;
  if (compact.length <= 10) return compact;
  const withoutCommonEndings = compact.replace(/すること$/u, "する").replace(/であること$/u, "").replace(/こと$/u, "");
  if (withoutCommonEndings.length <= 10) return withoutCommonEndings;
  return withoutCommonEndings.slice(0, 10);
}

function getJapaneseHint(value: string | null, hiragana?: string | null, romaji?: string | null): JapaneseHint | null {
  const japanese = getShortJapaneseHint(value);
  if (!japanese) return null;
  return { japanese, hiragana, romaji };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuizText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string) {
  const trimmed = normalizeQuizText(value).replace(/^[,.;:!?）)\]\s-]+/u, "");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function removeExpressionReference(value: string, expression: string) {
  const cleanExpression = normalizeQuizText(expression);
  if (!cleanExpression || cleanExpression.length <= 1) return value;

  const escapedExpression = escapeRegExp(cleanExpression).replace(/\\ /g, "\\s+");
  const expressionPattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedExpression}(?=$|[^\\p{L}\\p{N}])`, "giu");
  return value.replace(expressionPattern, "$1");
}

function removeDefinitionFrame(value: string) {
  return normalizeQuizText(value)
    .replace(/^(it|this word|this phrase|this expression)\s+(means|is used to mean|is used when|describes|refers to)\s+/iu, "")
    .replace(/^(means|mean|is used to mean|is used to say|is used when|refers to|describes)\s+/iu, "")
    .replace(/^(is|are)\s+/iu, "");
}

function limitDefinitionLength(value: string) {
  const firstSentence = value.match(/^[^.!?]+[.!?]?/u)?.[0]?.trim() ?? value;
  const words = firstSentence.split(/\s+/u).filter(Boolean);
  const shortened = words.length > 18 ? `${words.slice(0, 18).join(" ")}.` : firstSentence;
  return /[.!?]$/u.test(shortened) ? shortened : `${shortened}.`;
}

function getQuizDefinition(expression: string, meaning: string) {
  const cleanExpression = normalizeQuizText(expression);
  let definition = normalizeQuizText(meaning);

  if (cleanExpression) {
    const escapedExpression = escapeRegExp(cleanExpression).replace(/\\ /g, "\\s+");
    definition = definition
      .replace(new RegExp(`^${escapedExpression}\\s+(means|mean|is|are|refers to|describes|shows)\\s+`, "iu"), "")
      .replace(new RegExp(`^${escapedExpression}\\s+is\\s+used\\s+to\\s+(mean|say|describe)\\s+`, "iu"), "");
  }

  definition = removeExpressionReference(definition, cleanExpression);
  definition = removeDefinitionFrame(definition);
  definition = sentenceCase(definition);

  return limitDefinitionLength(definition);
}

function cleanMeaningChoices(choiceList: MeaningChoice[]) {
  return choiceList.map((choice) => {
    const withoutAnswerNames = choiceList.reduce(
      (definition, item) => removeExpressionReference(definition, item.displayExpression),
      choice.english,
    );
    return {
      ...choice,
      english: limitDefinitionLength(sentenceCase(removeDefinitionFrame(withoutAnswerNames))),
    };
  });
}

function toMeaningChoice(item: PassageQuizItem): MeaningChoice | null {
  const english = item.simpleEnglish?.trim();
  if (!english) return null;
  return {
    normalizedExpression: item.normalizedExpression,
    displayExpression: item.expression,
    english: getQuizDefinition(item.expression, english),
    japaneseHint: getJapaneseHint(item.japaneseMeaning, item.japaneseMeaningHiragana, item.japaneseMeaningRomaji),
  };
}

function labelForQuestionType(value: QuestionTypeSetting | QuizQuestionType) {
  if (value === "meaning") return "Meaning";
  if (value === "word") return "Word";
  return "Mixed";
}

function countFromSetting(setting: QuestionCountSetting, availableCount: number) {
  if (setting === "all") return availableCount;
  return Math.min(Number(setting), availableCount);
}

function choicesForMeanings(items: PassageQuizItem[], correct: PassageQuizItem) {
  const correctChoice = toMeaningChoice(correct);
  if (!correctChoice) return [];
  const seenMeanings = new Set([correctChoice.english]);
  const wrongChoices = shuffle(items)
    .filter((item) => item.normalizedExpression !== correct.normalizedExpression)
    .map(toMeaningChoice)
    .filter((choice): choice is MeaningChoice => Boolean(choice))
    .filter((choice) => {
      if (seenMeanings.has(choice.english)) return false;
      seenMeanings.add(choice.english);
      return true;
    })
    .slice(0, 3);
  return shuffle(cleanMeaningChoices([correctChoice, ...wrongChoices]));
}

function choicesForExpressions(items: PassageQuizItem[], correct: PassageQuizItem) {
  const seenExpressions = new Set([correct.expression]);
  const wrongChoices = shuffle(items)
    .filter((item) => item.normalizedExpression !== correct.normalizedExpression)
    .map((item) => item.expression)
    .filter((expression) => {
      if (!expression || seenExpressions.has(expression)) return false;
      seenExpressions.add(expression);
      return true;
    })
    .slice(0, 3);
  return shuffle([correct.expression, ...wrongChoices]);
}

function buildQuestion(item: PassageQuizItem, pool: PassageQuizItem[], questionTypeSetting: QuestionTypeSetting): PassageQuizQuestion | null {
  const questionType: QuizQuestionType = questionTypeSetting === "mixed" ? shuffle<QuizQuestionType>(["meaning", "word"])[0] : questionTypeSetting;
  const englishMeaning = item.simpleEnglish ? getQuizDefinition(item.expression, item.simpleEnglish) : "";
  if (!englishMeaning) return null;
  const correctMeaning = toMeaningChoice(item);
  if (!correctMeaning) return null;
  const choices = questionType === "meaning" ? choicesForMeanings(pool, item) : choicesForExpressions(pool, item);
  if (choices.length < 2) return null;

  return {
    expressionId: item.expressionId,
    normalizedExpression: item.normalizedExpression,
    displayExpression: item.expression,
    sourceSentence: item.sourceSentence,
    questionType,
    englishMeaning,
    japaneseHint: correctMeaning.japaneseHint,
    prompt: questionType === "meaning" ? item.expression : correctMeaning,
    choices,
    correctKey: questionType === "meaning" ? item.normalizedExpression : item.expression,
  };
}

function buildSessionQuestions(items: PassageQuizItem[], questionCountSetting: QuestionCountSetting, questionTypeSetting: QuestionTypeSetting) {
  const pool = items.filter(hasEnglish);
  const count = countFromSetting(questionCountSetting, pool.length);
  return shuffle(pool)
    .map((item) => buildQuestion(item, pool, questionTypeSetting))
    .filter((question): question is PassageQuizQuestion => Boolean(question))
    .slice(0, count);
}

function choiceKey(choice: MeaningChoice | string) {
  return typeof choice === "string" ? choice : choice.normalizedExpression;
}

function meaningChoiceLabel(choice: MeaningChoice) {
  return choice.japaneseHint ? `${choice.english}（${choice.japaneseHint.japanese}）` : choice.english;
}

function MeaningDisplay({ choice, showJapaneseHint }: { choice: MeaningChoice; showJapaneseHint: boolean }) {
  return (
    <span className="quiz-meaning-choice">
      <span>{choice.english}</span>
      {showJapaneseHint && choice.japaneseHint ? <JapaneseHintBlock hint={choice.japaneseHint} /> : null}
    </span>
  );
}

function ChoiceStateLabel({ state }: { state: "correct-selected" | "wrong-selected" | "correct-answer" }) {
  if (state === "wrong-selected") {
    return <span className="passage-quiz-choice-label"><span aria-hidden="true">✕</span> Not quite</span>;
  }
  if (state === "correct-answer") {
    return <span className="passage-quiz-choice-label"><span aria-hidden="true">✓</span> Correct answer</span>;
  }
  return <span className="passage-quiz-choice-label"><span aria-hidden="true">✓</span> Correct!</span>;
}

export function PassageVocabularyQuiz({
  items,
  savedWordCount,
  passageId,
}: {
  items: PassageQuizItem[];
  savedWordCount: number;
  passageId: string;
}) {
  const quizItems = useMemo(() => uniqueByNormalized(items), [items]);
  const englishReadyCount = quizItems.filter(hasEnglish).length;
  const japaneseHintCount = quizItems.filter((item) => getJapaneseHint(item.japaneseMeaning, item.japaneseMeaningHiragana, item.japaneseMeaningRomaji)).length;
  const [questionCountSetting, setQuestionCountSetting] = useState<QuestionCountSetting>("10");
  const [questionTypeSetting, setQuestionTypeSetting] = useState<QuestionTypeSetting>("meaning");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [showJapaneseHints, setShowJapaneseHints] = useState(false);

  function startQuiz(sourceItems = quizItems, settings = { questionCountSetting, questionTypeSetting }) {
    const questions = buildSessionQuestions(sourceItems, settings.questionCountSetting, settings.questionTypeSetting);
    if (!questions.length) return;
    setShowJapaneseHints(false);
    setSession({
      questions,
      answers: Array.from({ length: questions.length }, () => null),
      currentIndex: 0,
      finished: false,
      questionCountSetting: settings.questionCountSetting,
      questionTypeSetting: settings.questionTypeSetting,
    });
  }

  function answerCurrent(choice: MeaningChoice | string) {
    const key = choiceKey(choice);
    setSession((current) => {
      if (!current || current.answers[current.currentIndex] !== null) return current;
      const answers = [...current.answers];
      answers[current.currentIndex] = key;
      return { ...current, answers };
    });
  }

  function nextQuestion() {
    setSession((current) => {
      if (!current) return current;
      if (current.currentIndex >= current.questions.length - 1) return { ...current, finished: true };
      setShowJapaneseHints(false);
      return { ...current, currentIndex: current.currentIndex + 1 };
    });
  }

  function tryAgain() {
    if (!session) return;
    startQuiz(quizItems, {
      questionCountSetting: session.questionCountSetting,
      questionTypeSetting: session.questionTypeSetting,
    });
  }

  function tryWrongAnswers() {
    if (!session) return;
    const wrongSet = new Set(session.questions
      .filter((question, index) => session.answers[index] !== question.correctKey)
      .map((question) => question.normalizedExpression));
    const wrongItems = quizItems.filter((item) => wrongSet.has(item.normalizedExpression));
    if (!wrongItems.length) return;
    startQuiz(wrongItems, {
      questionCountSetting: session.questionCountSetting,
      questionTypeSetting: session.questionTypeSetting,
    });
  }

  if (!session) {
    return (
      <div className="card passage-quiz-card">
        <div className="passage-quiz-header">
          <div>
            <p className="eyebrow">Passage quiz</p>
            <h1 className="title passage-quiz-title">Start a quiz</h1>
            <p className="subtitle">Use only words saved from this passage.</p>
          </div>
        </div>
        <div className="passage-quiz-stats" aria-live="polite">
          <span>{savedWordCount} saved words</span>
          <span>{englishReadyCount} ready for quiz</span>
          <span>{japaneseHintCount} with Japanese hints</span>
        </div>
        <QuizSettingGroup
          title="Number of questions"
          options={[["10", "10"], ["20", "20"], ["30", "30"], ["all", "All"]]}
          value={questionCountSetting}
          onChange={(value) => setQuestionCountSetting(value as QuestionCountSetting)}
        />
        <QuizSettingGroup
          title="Question type"
          options={[["meaning", "Meaning"], ["word", "Word"], ["mixed", "Mixed"]]}
          value={questionTypeSetting}
          onChange={(value) => setQuestionTypeSetting(value as QuestionTypeSetting)}
        />
        {englishReadyCount === 0 ? <div className="notice notice-warn">No words are ready for quiz yet.</div> : null}
        <div className="passage-quiz-actions">
          <button type="button" className="btn btn-primary" disabled={englishReadyCount === 0} onClick={() => startQuiz()}>
            Start
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = session.questions[session.currentIndex];
  const selectedAnswer = session.answers[session.currentIndex];
  const answered = selectedAnswer !== null;
  const correct = selectedAnswer === currentQuestion.correctKey;
  const score = session.questions.filter((question, index) => session.answers[index] === question.correctKey).length;
  const wrongCount = session.questions.length - score;
  const correctAnswerText = currentQuestion.questionType === "meaning"
    ? meaningChoiceLabel({
      normalizedExpression: currentQuestion.normalizedExpression,
      displayExpression: currentQuestion.displayExpression,
      english: currentQuestion.englishMeaning,
      japaneseHint: currentQuestion.japaneseHint,
    })
    : currentQuestion.displayExpression;

  if (session.finished) {
    return (
      <div className="card passage-quiz-card">
        <p className="eyebrow">Passage quiz</p>
        <h1 className="title passage-quiz-title">Quiz complete</h1>
        <div className="passage-quiz-stats">
          <span>Score: {score} / {session.questions.length}</span>
          <span>Question type: {labelForQuestionType(session.questionTypeSetting)}</span>
        </div>
        <div className="passage-quiz-actions">
          <button type="button" className="btn btn-primary" onClick={tryAgain}>Try again</button>
          <button type="button" className="btn btn-soft" onClick={tryWrongAnswers} disabled={wrongCount === 0}>Try wrong answers</button>
          <Link className="btn" href={`/passages/${passageId}`}>Back to passage</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card passage-quiz-card">
      <div className="passage-quiz-header">
        <div>
          <p className="eyebrow">Passage quiz</p>
          <h1 className="title passage-quiz-title">{currentQuestion.questionType === "meaning" ? "Choose the meaning" : "Choose the word"}</h1>
          <p className="subtitle">Question type: {labelForQuestionType(currentQuestion.questionType)}</p>
        </div>
        <button type="button" className="btn btn-soft" onClick={tryAgain}>
          <RotateCcw size={16} /> Try again
        </button>
      </div>
      <div className="passage-quiz-stats" aria-live="polite">
        <span>Question {session.currentIndex + 1} / {session.questions.length}</span>
        <span>Correct: {score}</span>
      </div>
      <section className="passage-quiz-question-card">
        <p className="label">{currentQuestion.questionType === "meaning" ? "Expression" : "Meaning"}</p>
        <h2>
          {typeof currentQuestion.prompt === "string"
            ? currentQuestion.prompt
            : <MeaningDisplay choice={currentQuestion.prompt} showJapaneseHint={showJapaneseHints} />}
        </h2>
        <PronunciationButton text={currentQuestion.displayExpression} />
        {currentQuestion.sourceSentence ? <p className="passage-quiz-context">“{currentQuestion.sourceSentence}”</p> : null}
        <p className="hint">{currentQuestion.questionType === "meaning" ? "Choose the meaning." : "Choose the English expression."}</p>
      </section>
      <div className="passage-quiz-options">
        {currentQuestion.choices.map((choice, index) => {
          const key = choiceKey(choice);
          const isCorrectChoice = key === currentQuestion.correctKey;
          const picked = key === selectedAnswer;
          const choiceState = answered && picked && isCorrectChoice
            ? "correct-selected"
            : answered && picked && !isCorrectChoice
              ? "wrong-selected"
              : answered && isCorrectChoice
                ? "correct-answer"
                : null;
          return (
            <button
              key={`${key}-${index}`}
              type="button"
              className="btn passage-quiz-option"
              disabled={answered}
              data-correct={answered && isCorrectChoice ? "true" : undefined}
              data-picked-wrong={answered && picked && !isCorrectChoice ? "true" : undefined}
              data-muted={answered && !picked && !isCorrectChoice ? "true" : undefined}
              onClick={() => answerCurrent(choice)}
            >
              {choiceState ? <ChoiceStateLabel state={choiceState} /> : null}
              <span className="passage-quiz-choice-content">
                {typeof choice === "string" ? choice : <MeaningDisplay choice={choice} showJapaneseHint={showJapaneseHints} />}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn-soft passage-quiz-hint-toggle" onClick={() => setShowJapaneseHints((value) => !value)}>
        {showJapaneseHints ? "Hide Japanese hints" : "Show Japanese hints"}
      </button>
      {answered ? (
        <div className="notice passage-quiz-answer" data-correct={correct ? "true" : undefined}>
          <strong>{correct ? "Correct." : "Not correct."}</strong>
          <p><span>Correct answer:</span> {correctAnswerText}</p>
          <Link href={`/expressions/${currentQuestion.expressionId}`} className="reading-mode-detail-link">Open full memo</Link>
        </div>
      ) : null}
      <div className="passage-quiz-actions">
        <button type="button" className="btn btn-primary" onClick={nextQuestion} disabled={!answered}>
          {session.currentIndex >= session.questions.length - 1 ? "See results" : "Next question"}
        </button>
      </div>
    </div>
  );
}

function QuizSettingGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="passage-quiz-setting">
      <legend className="label">{title}</legend>
      <div className="passage-quiz-choice-row">
        {options.map(([optionValue, label]) => (
          <button
            key={optionValue}
            type="button"
            className="btn"
            aria-pressed={value === optionValue}
            data-active={value === optionValue ? "true" : undefined}
            onClick={() => onChange(optionValue)}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
