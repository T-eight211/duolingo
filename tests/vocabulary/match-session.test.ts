import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_EXERCISE_TYPES,
  getStagePairCounts,
  createExerciseStage,
  createSessionPlan,
  type WordPair,
} from "@/app/practice/words/match/session-plan";

function generateWordPairs(count: number): WordPair[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `word-${i + 1}`,
    english: `English ${i + 1}`,
    arabic: `عربي ${i + 1}`,
    audioSrc: `https://example.com/audio/${i + 1}.mp3`,
  }));
}

test("en_ar_no_audio has 5 initial pairs, 16 swaps, english left, arabic right, and no audio", () => {
  const counts = getStagePairCounts("en_ar_no_audio");
  assert.equal(counts.initial, 5);
  assert.equal(counts.swaps, 16);

  const words = generateWordPairs(30);
  const stage = createExerciseStage("en_ar_no_audio", words);

  assert.equal(stage.type, "en_ar_no_audio");
  assert.equal(stage.leftKind, "english");
  assert.equal(stage.rightKind, "arabic");
  assert.equal(stage.hasAudio, false);
  assert.equal(stage.isListening, false);
  assert.equal(stage.hasRefill, true);
  assert.equal(stage.initialPairs.length, 5);
  assert.equal(stage.extraPairs.length, 16);
  assert.equal(stage.totalCount, 21);
  assert.equal(stage.initialSlots, 5);
  assert.equal(stage.initialLeftSlots.length, 5);
  assert.equal(stage.initialRightSlots.length, 5);
});

test("ALL_EXERCISE_TYPES includes en_ar_no_audio alongside standard exercises", () => {
  assert.ok(ALL_EXERCISE_TYPES.includes("en_ar_no_audio"));
  assert.ok(ALL_EXERCISE_TYPES.includes("en_ar_cascade"));
  assert.ok(ALL_EXERCISE_TYPES.includes("en_ar_static"));
  assert.ok(ALL_EXERCISE_TYPES.includes("audio_en"));
  assert.ok(ALL_EXERCISE_TYPES.includes("audio_ar"));
});

test("createSessionPlan creates 3 valid stages from vocabulary", () => {
  const words = generateWordPairs(30);
  const plan = createSessionPlan(words);

  assert.equal(plan.stages.length, 3);
  for (const stage of plan.stages) {
    assert.ok(stage.totalCount >= 5);
    assert.equal(stage.initialSlots, 5);
    assert.equal(stage.initialPairs.length, 5);
    if (stage.type === "en_ar_no_audio") {
      assert.equal(stage.hasAudio, false);
      assert.equal(stage.extraPairs.length, 16);
      assert.equal(stage.totalCount, 21);
      assert.equal(stage.leftKind, "english");
      assert.equal(stage.rightKind, "arabic");
    }
  }
});
