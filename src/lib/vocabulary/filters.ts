import { z } from "zod";
import type { VocabularyEntry } from "./schema";
import { matchesVocabularySearch } from "./search";

export const MIN_PRACTICE_WORDS = 40;
export const vocabularyFiltersSchema = z.object({
  q: z.string().max(4000).default(""),
  category: z.string().max(200).default("all"),
  pos: z.enum(["all", "noun", "verb", "particle"]).default("all"),
  status: z.enum(["all", "needs-practice", "mastered", "unpracticed"]).default("all"),
});
export type VocabularyFilters = z.infer<typeof vocabularyFiltersSchema>;

export function filterVocabulary(entries: VocabularyEntry[], filters: VocabularyFilters) {
  return entries.filter((word) => {
    if (!matchesVocabularySearch(word, filters.q)) return false;
    if (filters.category !== "all") {
      const tags = (word.category ?? "").split(",").map((tag) => tag.trim().toLowerCase());
      if (!tags.includes(filters.category.toLowerCase())) return false;
    }
    if (filters.pos !== "all" && word.partOfSpeech !== filters.pos) return false;
    const errors = word.errorCount ?? 0;
    const correct = word.correctCount ?? 0;
    if (filters.status === "needs-practice" && errors <= 0) return false;
    if (filters.status === "mastered" && (correct <= 0 || errors > 0)) return false;
    if (filters.status === "unpracticed" && (errors > 0 || correct > 0)) return false;
    return true;
  });
}

export function practiceHref(filters: VocabularyFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.pos !== "all") params.set("pos", filters.pos);
  if (filters.status !== "all") params.set("status", filters.status);
  return `/practice/words/match${params.size ? `?${params}` : ""}`;
}
