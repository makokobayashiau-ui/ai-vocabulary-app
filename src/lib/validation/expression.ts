import { z } from "zod";
import { CATEGORIES, LEARNING_STATUSES } from "@/lib/constants";

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max.toLocaleString()} characters or less.`).optional()
    .transform((value) => value || null);

export const expressionSchema = z.object({
  target_expression: z.string().trim().min(1, "Please enter a word or phrase.").max(300, "Please use 300 characters or less."),
  source_sentence: optionalText(5000, "Sentence"),
  source_passage: optionalText(30000, "Text around it"),
  source_title: optionalText(500, "Source title"),
  category: z.enum(CATEGORIES.map((item) => item.value) as [string, ...string[]], { error: "Please choose a category." }),
  user_memo: optionalText(3000, "Memo"),
});

export const createExpressionSchema = expressionSchema;

export const updateExpressionSchema = expressionSchema.extend({
  learning_status: z.enum(LEARNING_STATUSES).default("unreviewed"),
});

export const expressionIdSchema = z.string().uuid();

export type ExpressionInput = z.infer<typeof updateExpressionSchema>;

function baseFormData(formData: FormData) {
  return {
    target_expression: formData.get("target_expression"),
    source_sentence: formData.get("source_sentence") || undefined,
    source_passage: formData.get("source_passage") || undefined,
    source_title: formData.get("source_title") || undefined,
    category: formData.get("category"),
    user_memo: formData.get("user_memo") || undefined,
  };
}

export function formDataToCreateExpression(formData: FormData) {
  return createExpressionSchema.safeParse(baseFormData(formData));
}

export function formDataToUpdateExpression(formData: FormData) {
  return updateExpressionSchema.safeParse({
    ...baseFormData(formData),
    learning_status: formData.get("learning_status") || "unreviewed",
  });
}
