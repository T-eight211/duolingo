import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesVocabularySearch,
  normalizeArabicSearch,
} from "@/lib/vocabulary/search";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";

test("normalizeArabicSearch strips diacritics and normalizes letter forms", () => {
  // Tashkeel removal
  assert.equal(normalizeArabicSearch("تَاجِرٌ"), "تاجر");
  assert.equal(normalizeArabicSearch("التَّاجِرُ"), "التاجر");

  // Alif normalization (أ, إ, آ, ٱ -> ا)
  assert.equal(normalizeArabicSearch("أَبٌ"), "اب");
  assert.equal(normalizeArabicSearch("إِيمَان"), "ايمان");
  assert.equal(normalizeArabicSearch("آخَر"), "اخر");

  // Taa marbuta and alif maqsura
  assert.equal(normalizeArabicSearch("مَدْرَسَةٌ"), "مدرسه");
  assert.equal(normalizeArabicSearch("مُسْتَشْفَى"), "مستشفي");
});

test("matchesVocabularySearch matches English queries correctly", () => {
  const word: Pick<VocabularyEntry, "english" | "arabic" | "arabicDiacritized"> = {
    english: "merchant",
    arabic: "التاجر",
    arabicDiacritized: "التَّاجِرُ",
  };

  assert.equal(matchesVocabularySearch(word, "merchant"), true);
  assert.equal(matchesVocabularySearch(word, "merch"), true);
  assert.equal(matchesVocabularySearch(word, "MERCHANT"), true);
  assert.equal(matchesVocabularySearch(word, "food"), false);
});

test("matchesVocabularySearch matches Arabic with and without diacritics", () => {
  const word: Pick<VocabularyEntry, "english" | "arabic" | "arabicDiacritized"> = {
    english: "merchant",
    arabic: "التاجر",
    arabicDiacritized: "التَّاجِرُ",
  };

  // Plain Arabic search
  assert.equal(matchesVocabularySearch(word, "تاجر"), true);
  assert.equal(matchesVocabularySearch(word, "التاجر"), true);

  // Search with diacritics
  assert.equal(matchesVocabularySearch(word, "تَاجِرٌ"), true);
  assert.equal(matchesVocabularySearch(word, "التَّاجِرُ"), true);

  // Unrelated word
  assert.equal(matchesVocabularySearch(word, "سيارة"), false);
});

test("matchesVocabularySearch handles alif variants (أ/إ/ا)", () => {
  const word: Pick<VocabularyEntry, "english" | "arabic" | "arabicDiacritized"> = {
    english: "father",
    arabic: "الأب",
    arabicDiacritized: "الأَبُ",
  };

  assert.equal(matchesVocabularySearch(word, "اب"), true);
  assert.equal(matchesVocabularySearch(word, "أب"), true);
  assert.equal(matchesVocabularySearch(word, "الأب"), true);
  assert.equal(matchesVocabularySearch(word, "الأَبُ"), true);
});

test("multiple categories/tags per word match individual tags", () => {
  const word1 = {
    id: "1",
    english: "he wrote",
    category: "Lesson 1, Verbs, Past Tense",
  };
  const word2 = {
    id: "2",
    english: "book",
    category: "Lesson 1, Nouns",
  };

  const vocabulary = [word1, word2];

  // Extract individual unique tags
  const tags = Array.from(
    new Set(
      vocabulary.flatMap((w) =>
        w.category ? w.category.split(",").map((t) => t.trim()).filter(Boolean) : [],
      ),
    ),
  ).sort();

  assert.deepEqual(tags, ["Lesson 1", "Nouns", "Past Tense", "Verbs"]);

  // Filtering by "Verbs" should match word1
  const verbWords = vocabulary.filter((w) => {
    const wTags = w.category.split(",").map((t) => t.trim().toLowerCase());
    return wTags.includes("verbs");
  });
  assert.equal(verbWords.length, 1);
  assert.equal(verbWords[0].id, "1");

  // Filtering by "Lesson 1" should match both words
  const lesson1Words = vocabulary.filter((w) => {
    const wTags = w.category.split(",").map((t) => t.trim().toLowerCase());
    return wTags.includes("lesson 1");
  });
  assert.equal(lesson1Words.length, 2);
});
