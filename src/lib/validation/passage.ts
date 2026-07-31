import { z } from "zod";
import { PASSAGE_CATEGORIES } from "@/lib/constants";

const passageCategoryValues = PASSAGE_CATEGORIES.map((item) => item.value) as [string, ...string[]];

export const passageSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title.").max(500, "Please use 500 characters or less."),
  content: z.string().trim().min(1, "Please enter the passage text.").max(50000, "Please use 50,000 characters or less."),
  source_url: z.string().trim().max(2000, "Please use 2,000 characters or less.").optional()
    .transform((value) => value || null),
  category: z.enum(passageCategoryValues, { error: "Please choose a category." }),
});

export const passageMetadataSchema = passageSchema.omit({ content: true });

export const passageIdSchema = z.string().uuid();

function baseFormData(formData: FormData) {
  return {
    title: formData.get("title"),
    content: formData.get("content"),
    source_url: formData.get("source_url") || undefined,
    category: formData.get("category") || "other",
  };
}

export function formDataToPassage(formData: FormData) {
  return passageSchema.safeParse(baseFormData(formData));
}

export function formDataToPassageMetadata(formData: FormData) {
  const values = baseFormData(formData);
  return passageMetadataSchema.safeParse({
    title: values.title,
    source_url: values.source_url,
    category: values.category,
  });
}
