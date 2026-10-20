import type { VocabularyEntry } from "../../src/lib/vocabulary/schema";

export const word = (
  overrides: Partial<VocabularyEntry> = {},
): VocabularyEntry => ({
  id: "word",
  kind: "word",
  arabic: "كتاب",
  arabicDiacritized: "كِتَابٌ",
  english: "book",
  originalArabic: "كتاب",
  originalEnglish: null,
  corrections: [],
  needsReview: false,
  reviewReason: null,
  sourceIds: [],
  ...overrides,
});
export const sentence = (
  overrides: Partial<VocabularyEntry> = {},
): VocabularyEntry =>
  word({
    id: "sentence",
    kind: "sentence",
    arabic: "هذا كتاب",
    arabicDiacritized: "هَذَا كِتَابٌ",
    english: "This is a book.",
    ...overrides,
  });
