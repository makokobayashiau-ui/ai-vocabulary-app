export type LearningStatus = "unreviewed" | "english_reviewed" | "japanese_revealed" | "practicing" | "understood" | "needs_review" | "mastered";

export type PassageCategory = "ielts" | "nursing" | "news" | "youtube" | "daily_conversation" | "other";

export type ExpressionLearningStatus = "new" | "learning" | "known";

export type ExplanationGenerationStatus = "pending" | "completed" | "failed";

export type ExpressionType =
  | "word"
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "auxiliary_verb"
  | "phrasal_verb"
  | "idiom"
  | "collocation"
  | "noun_phrase"
  | "fixed_expression"
  | "other";

export type MiniQuizType = "multiple_choice" | "fill_in_the_blank";

export type MiniQuiz = {
  quiz_type: MiniQuizType;
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
};

export type RelatedExpression = {
  expression: string;
  japanese: string | null;
};

export type Passage = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  source_url: string | null;
  category: PassageCategory;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Expression = {
  id: string;
  user_id: string;
  passage_id: string | null;
  selection_start: number | null;
  selection_end: number | null;
  target_expression: string;
  normalized_expression: string;
  source_sentence: string | null;
  source_passage: string | null;
  source_title: string | null;
  category: string;
  user_memo: string | null;
  learning_status: LearningStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpressionLearningState = {
  id: string;
  user_id: string;
  normalized_expression: string;
  learning_status: ExpressionLearningStatus;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpressionExplanation = {
  id: string;
  user_id: string;
  normalized_expression: string;
  display_expression: string;
  expression_type: ExpressionType | null;
  simple_english_explanation: string | null;
  example_sentences: string[] | null;
  japanese_meaning: string | null;
  japanese_meaning_hiragana: string | null;
  japanese_meaning_romaji: string | null;
  usage_notes: string | null;
  usage_notes_ja: string | null;
  mnemonic: string | null;
  mnemonic_ja: string | null;
  mini_quiz: MiniQuiz | null;
  collocations: string[] | null;
  synonyms: RelatedExpression[] | null;
  antonyms: RelatedExpression[] | null;
  generation_status: ExplanationGenerationStatus;
  error_message: string | null;
  model: string | null;
  prompt_version: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpressionGroupSummary = {
  normalized_expression: string;
  display_expression: string;
  representative_expression_id: string;
  occurrence_count: number;
  passage_count: number;
  first_created_at: string;
  latest_created_at: string;
  learning_status: ExpressionLearningStatus;
  is_favorite: boolean;
  total_count: number;
};

export type PassageExpressionCountSummary = {
  passage_id: string;
  title: string;
  category: PassageCategory;
  distinct_expression_count: number;
  total_expression_count: number;
  latest_expression_created_at: string;
  total_count: number;
};

export type PassageExpressionGroupSummary = {
  normalized_expression: string;
  display_expression: string;
  representative_expression_id: string;
  occurrence_count: number;
  first_created_at: string;
  latest_created_at: string;
  learning_status: ExpressionLearningStatus;
  is_favorite: boolean;
  total_count: number;
};

export type SavedExpressionContext = Expression & {
  passage_title: string | null;
  passage_deleted_at: string | null;
};
