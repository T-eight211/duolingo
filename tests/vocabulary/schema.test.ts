import assert from "node:assert/strict";
import test from "node:test";
import {
  deduplicateVocabularyEntries,
  saveVocabularySchema,
  stripArabicDiacritics,
  vocabularyKey,
} from "../../src/lib/vocabulary/schema";
import {
  prepareVocabularySave,
  vocabularyStorageKey,
} from "../../src/db/vocabulary-plan";
import { word, sentence } from "./fixtures";

test("duplicates match on exact Arabic vowels regardless of English translation, while different vowels remain distinct", () => {
  assert.equal(
    vocabularyKey(word()),
    vocabularyKey(word({ arabicDiacritized: " كِـتَابٌ! ", english: " A BOOK. " })),
  );
  assert.notEqual(
    vocabularyKey(word({ arabicDiacritized: "عَمِلَ" })),
    vocabularyKey(word({ arabicDiacritized: "عَمَلٌ" })),
  );
  assert.notEqual(
    vocabularyKey(word({ arabicDiacritized: "سَافَرَ" })),
    vocabularyKey(word({ arabicDiacritized: "سَافِرْ" })),
  );
  assert.notEqual(
    vocabularyKey(word({ arabicDiacritized: "أمل" })),
    vocabularyKey(word({ arabicDiacritized: "امل" })),
  );
  assert.equal(stripArabicDiacritics("كِـتَابٌ"), "كتاب");
  assert.equal(vocabularyStorageKey(word()).length, 64);
});

test("deduplication preserves every parent, correction, uncertainty and original without mutating inputs", () => {
  const input = [
    sentence(),
    sentence({ id: "s2" }),
    sentence({ id: "s3", english: "Here is a book." }),
    word({ id: "w1", sourceIds: ["sentence"] }),
    word({
      id: "w2",
      sourceIds: ["s2", "s3"],
      originalEnglish: "bok",
      corrections: ["english_spelling"],
      needsReview: true,
      reviewReason: "Check handwriting",
    }),
  ];
  const snapshot = JSON.stringify(input);
  const result = deduplicateVocabularyEntries(input);
  assert.equal(result.duplicates, 3);
  const merged = result.entries.find((entry) => entry.kind === "word")!;
  assert.deepEqual(merged.sourceIds, ["sentence"]);
  assert.equal(merged.originalEnglish, "bok");
  assert.deepEqual(merged.corrections, ["english_spelling"]);
  assert.equal(merged.needsReview, true);
  assert.equal(JSON.stringify(input), snapshot);
  const plan = prepareVocabularySave(input);
  assert.equal(plan.entries.length, 2);
  assert.equal(plan.links.length, 1);
});

test("save validates both languages, Arabic consistency, local IDs and sentence references", () => {
  assert.equal(
    saveVocabularySchema.safeParse({
      entries: [sentence(), word({ sourceIds: ["sentence"] })],
    }).success,
    true,
  );
  for (const entries of [
    [],
    [word({ english: "  " })],
    [word({ arabic: "123", arabicDiacritized: "123" })],
    [word({ arabic: "بيت" })],
    [word(), word()],
    [word({ sourceIds: ["missing"] })],
    [sentence({ sourceIds: ["sentence"] })],
  ]) {
    assert.equal(saveVocabularySchema.safeParse({ entries }).success, false);
  }
  assert.equal(
    saveVocabularySchema.safeParse({
      entries: [
        word({ needsReview: true, reviewReason: "Confirm this meaning" }),
      ],
    }).success,
    true,
  );
});

test("deduplication preserves audioSrc and schema validates it", () => {
  const w1 = word({ id: "w1", audioSrc: "https://example.com/audio.mp3" });
  const w2 = word({ id: "w2" });
  const deduped = deduplicateVocabularyEntries([w1, w2]);
  assert.equal(deduped.entries[0].audioSrc, "https://example.com/audio.mp3");

  const parsed = saveVocabularySchema.safeParse({ entries: [w1] });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.entries[0].audioSrc, "https://example.com/audio.mp3");
  }
});

test("vocabularyEntrySchema and saveVocabularySchema support category", () => {
  const w1 = word({ id: "w1", category: "Lesson 1" });
  const parsed = saveVocabularySchema.safeParse({
    category: "Lesson 1",
    entries: [w1],
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.category, "Lesson 1");
    assert.equal(parsed.data.entries[0].category, "Lesson 1");
  }
});
