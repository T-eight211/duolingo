import assert from "node:assert/strict";
import test from "node:test";
import { filterVocabulary, practiceHref, vocabularyFiltersSchema } from "../../src/lib/vocabulary/filters";
import { word } from "./fixtures";

test("practice filters round-trip through the URL and intersect search, tags, grammar and status", () => {
  const filters = vocabularyFiltersSchema.parse({ q: "كِتاب", category: "Chapter 2", pos: "noun", status: "needs-practice" });
  const entries = [
    word({ id: "match", category: "Chapter 2, Books", partOfSpeech: "noun", errorCount: 2 }),
    word({ id: "other-chapter", category: "Chapter 1", partOfSpeech: "noun", errorCount: 2 }),
    word({ id: "other-status", category: "Chapter 2", partOfSpeech: "noun", correctCount: 3 }),
    word({ id: "other-pos", category: "Chapter 2", partOfSpeech: "verb", errorCount: 2 }),
    word({ id: "other-search", category: "Chapter 2", partOfSpeech: "noun", errorCount: 2, arabic: "قلم", arabicDiacritized: "قَلَمٌ", english: "pen" }),
  ];
  const url = new URL(practiceHref(filters), "https://example.test");
  const serverFilters = vocabularyFiltersSchema.parse(Object.fromEntries(url.searchParams));
  assert.deepEqual(serverFilters, filters);
  assert.deepEqual(filterVocabulary(entries, serverFilters).map((entry) => entry.id), ["match"]);
});

test("no filters preserves all words; status filters and invalid query values are handled consistently", () => {
  const entries = [word({ id: "new" }), word({ id: "mastered", correctCount: 2 }), word({ id: "errors", correctCount: 2, errorCount: 1 })];
  const defaults = vocabularyFiltersSchema.parse({});
  assert.equal(practiceHref(defaults), "/practice/words/match");
  assert.equal(filterVocabulary(entries, defaults).length, 3);
  assert.deepEqual(filterVocabulary(entries, { ...defaults, status: "mastered" }).map((w) => w.id), ["mastered"]);
  assert.deepEqual(filterVocabulary(entries, { ...defaults, status: "unpracticed" }).map((w) => w.id), ["new"]);
  assert.equal(vocabularyFiltersSchema.safeParse({ status: "invalid" }).success, false);
  assert.equal(vocabularyFiltersSchema.safeParse({ category: ["Chapter 1", "Chapter 2"] }).success, false);
});
