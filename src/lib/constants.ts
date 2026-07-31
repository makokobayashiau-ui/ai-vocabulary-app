export const CATEGORIES = [
  { value: "ielts", label: "IELTS" },
  { value: "dmm_eikaiwa", label: "DMM English" },
  { value: "youtube", label: "YouTube" },
  { value: "daily_conversation", label: "Daily life" },
  { value: "nursing", label: "Nursing" },
  { value: "other", label: "Other" },
] as const;

export const PASSAGE_CATEGORIES = [
  { value: "ielts", label: "IELTS" },
  { value: "nursing", label: "Nursing" },
  { value: "news", label: "News" },
  { value: "youtube", label: "YouTube" },
  { value: "daily_conversation", label: "Daily life" },
  { value: "other", label: "Other" },
] as const;

export const LEARNING_STATUSES = [
  "unreviewed", "english_reviewed", "japanese_revealed", "practicing",
  "understood", "needs_review", "mastered",
] as const;

export const STATUS_LABELS: Record<(typeof LEARNING_STATUSES)[number], string> = {
  unreviewed: "Not started",
  english_reviewed: "Read in English",
  japanese_revealed: "Japanese shown",
  practicing: "Learning",
  understood: "Learned",
  needs_review: "Needs review",
  mastered: "Mastered",
};

export const PAGE_SIZE = 20;

export const EXPRESSION_GROUP_LEARNING_STATUSES = ["new", "learning", "known"] as const;

export const EXPRESSION_GROUP_STATUS_LABELS: Record<(typeof EXPRESSION_GROUP_LEARNING_STATUSES)[number], string> = {
  new: "New",
  learning: "Learning",
  known: "Known",
};

export const EXPRESSION_GROUP_SORTS = ["latest", "count"] as const;

export const EXPRESSION_GROUP_VIEWS = ["all", "passages"] as const;

export const EXPRESSION_TYPES = [
  "word",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "auxiliary_verb",
  "phrasal_verb",
  "idiom",
  "collocation",
  "noun_phrase",
  "fixed_expression",
  "other",
] as const;

export function categoryLabel(value: string) {
  return CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

export function passageCategoryLabel(value: string) {
  return PASSAGE_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}
