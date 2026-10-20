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

test("duplicates ignore tashkeel, tatweel, case and punctuation but preserve Arabic letter distinctions and meanings", () => {
  assert.equal(
    vocabularyKey(word()),
    vocabularyKey(word({ arabicDiacritized: " كـتاب! ", english: " BOOK. " })),
  );
  assert.notEqual(
    vocabularyKey(word()),
    vocabularyKey(word({ english: "writer" })),
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
  assert.equal(result.duplicates, 2);
  const merged = result.entries.find((entry) => entry.kind === "word")!;
  assert.deepEqual(merged.sourceIds, ["sentence", "s3"]);
  assert.equal(merged.originalEnglish, "bok");
  assert.deepEqual(merged.corrections, ["english_spelling"]);
  assert.equal(merged.needsReview, true);
  assert.equal(JSON.stringify(input), snapshot);
  const plan = prepareVocabularySave(input);
  assert.equal(plan.entries.length, 3);
  assert.equal(plan.links.length, 2);
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

test("removed sentences are never recreated and different kinds remain separate", () => {
  const plan = prepareVocabularySave([word({ sourceIds: ["removed"] })]);
  assert.deepEqual(plan.links, []);
  assert.deepEqual(plan.entries[0].sourceIds, []);
  assert.equal(
    deduplicateVocabularyEntries([
      word(),
      word({ id: "phrase", kind: "phrase" }),
    ]).entries.length,
    2,
  );
});
