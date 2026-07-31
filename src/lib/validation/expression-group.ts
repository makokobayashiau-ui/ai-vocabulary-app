import { z } from "zod";
import { EXPRESSION_GROUP_LEARNING_STATUSES, EXPRESSION_GROUP_SORTS, EXPRESSION_GROUP_VIEWS } from "@/lib/constants";

export function normalizeExpression(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const normalizedExpressionSchema = z.string().trim().min(1).max(300).transform(normalizeExpression);

export const expressionGroupViewSchema = z.enum(EXPRESSION_GROUP_VIEWS).catch("all");

export const expressionGroupSortSchema = z.enum(EXPRESSION_GROUP_SORTS).catch("latest");

export const expressionGroupLearningStatusFilterSchema = z.enum(EXPRESSION_GROUP_LEARNING_STATUSES).optional().nullable().catch(null);

export const expressionGroupLearningStatusSchema = z.enum(EXPRESSION_GROUP_LEARNING_STATUSES);

export const booleanQuerySchema = z.union([z.literal("1"), z.literal("true"), z.literal("on")]).optional()
  .transform((value) => Boolean(value));

export const pageQuerySchema = z.string().optional().transform((value) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
});

export const searchQuerySchema = z.string().optional().transform((value) => (value ?? "").trim().slice(0, 200));

export const expressionGroupQuerySchema = z.object({
  view: expressionGroupViewSchema,
  q: searchQuerySchema,
  sort: expressionGroupSortSchema,
  status: expressionGroupLearningStatusFilterSchema,
  favorite: booleanQuerySchema,
  page: pageQuerySchema,
});

export type ExpressionGroupQuery = z.infer<typeof expressionGroupQuerySchema>;
