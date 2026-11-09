import assert from "node:assert/strict";
import test from "node:test";
import { checkTypedAnswer } from "../../src/app/practice/words/match/typing-answer";
import { createExerciseStage } from "../../src/app/practice/words/match/session-plan";

test("typing accepts omitted Arabic marks but rejects wrong letters and supplied vowels", () => {
  assert.equal(checkTypedAnswer("كَتَبَ", "كَتَبَ", true), "correct");
  assert.equal(checkTypedAnswer("كتب", "كَتَبَ", true), "missing-vowels");
  assert.equal(checkTypedAnswer("كَتب", "كَتَبَ", true), "missing-vowels");
  assert.equal(checkTypedAnswer("كُتب", "كَتَبَ", true), "incorrect");
  assert.equal(checkTypedAnswer("كتاب", "كَتَبَ", true), "incorrect");
  assert.equal(checkTypedAnswer("اكل", "أَكَلَ", true), "incorrect");
  assert.equal(checkTypedAnswer("  HE WORKS. ", "he works", false), "correct");
  assert.equal(checkTypedAnswer("", "he works", false), "incorrect");
  // Ignores parenthesized metadata like (m) / (f) in expected target
  assert.equal(checkTypedAnswer("first", "first (m)", false), "correct");
  assert.equal(checkTypedAnswer("Turkish", "Turkish (m)", false), "correct");
  // Supports alternatives separated by slashes, commas, or "or"
  assert.equal(checkTypedAnswer("big", "big / large", false), "correct");
  assert.equal(checkTypedAnswer("large", "big / large", false), "correct");
  assert.equal(checkTypedAnswer("big / large", "big / large", false), "correct");
  assert.equal(checkTypedAnswer("colleague", "Colleague / classmate", false), "correct");
  assert.equal(checkTypedAnswer("classmate", "Colleague / classmate", false), "correct");
  assert.equal(checkTypedAnswer("colleague, classmate", "Colleague / classmate", false), "correct");
  assert.equal(checkTypedAnswer("colleague or classmate", "Colleague / classmate", false), "correct");
  assert.equal(checkTypedAnswer("read", "to read / recite", false), "correct");
  assert.equal(checkTypedAnswer("to read", "to read / recite", false), "correct");
  assert.equal(checkTypedAnswer("recite", "to read / recite", false), "correct");
  assert.equal(checkTypedAnswer("to recite", "to read / recite", false), "correct");
  assert.equal(checkTypedAnswer("stranger", "Colleague / classmate", false), "incorrect");
});

test("both typing stages draw exactly ten words without refill", () => {
  const words = Array.from({ length: 40 }, (_, i) => ({
    id: String(i),
    arabic: "كَتَبَ",
    english: "he wrote",
  }));
  for (const type of ["type_arabic", "type_english"] as const) {
    const stage = createExerciseStage(type, words);
    assert.equal(stage.totalCount, 10);
    assert.equal(stage.initialPairs.length, 10);
    assert.equal(stage.hasRefill, false);
    assert.equal(stage.hasAudio, false);
  }
});
