import assert from "node:assert/strict";
import test from "node:test";
import { createGateway } from "ai";
import {
  extractVocabulary,
  VocabularyExtractionError,
} from "../../src/lib/vocabulary/extract";
import type { VocabularyUpload } from "../../src/lib/vocabulary/upload";

const gateway = createGateway({
  apiKey: "synthetic-test-key",
  baseURL: "http://127.0.0.1:4911/gateway",
});
const image: VocabularyUpload = {
  data: new Uint8Array([1, 2, 3]),
  mediaType: "image/jpeg",
  name: "fixture.jpg",
};
const status = (code: number) => (error: unknown) =>
  error instanceof VocabularyExtractionError && error.status === code;

test("real SDK sends image/PDF structured-output requests and merges duplicate sentence links", async () => {
  for (const upload of [
    image,
    { ...image, mediaType: "application/pdf" as const },
  ]) {
    const result = await extractVocabulary(upload, {
      model: gateway("test/good"),
    });
    assert.equal(result.entries.length, 2);
    assert.deepEqual(result.entries[1].sourceIds, ["s"]);
    assert.equal(result.entries[0].originalEnglish, "This is a bok.");
    assert.match(result.warnings[0], /combined/);
  }
});

test("unreadable, invalid and conflicting AI responses become useful errors", async () => {
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/empty") }),
    status(422),
  );
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/invalid") }),
    status(502),
  );
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/ids") }),
    status(502),
  );
  const result = await extractVocabulary(image, {
    model: gateway("test/uncertain"),
  });
  assert.equal(result.entries[0].needsReview, true);
  assert.equal(result.entries[0].english, "");
});

test("upstream access, rate limits and timeouts are handled without leaking provider details", async () => {
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/forbidden") }),
    status(503),
  );
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/limited") }),
    status(429),
  );
  await assert.rejects(
    extractVocabulary(image, { model: gateway("test/slow"), timeoutMs: 100 }),
    status(504),
  );
});
