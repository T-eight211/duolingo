import assert from "node:assert/strict";
import test, { before } from "node:test";
import { createGateway } from "ai";
import sharp from "sharp";
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
  data: new Uint8Array(),
  mediaType: "image/jpeg",
  name: "fixture.jpg",
};
before(async () => {
  image.data = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).jpeg().toBuffer();
});
const status = (code: number) => (error: unknown) =>
  error instanceof VocabularyExtractionError && error.status === code;

test("empty or missing-source first scans are rechecked automatically", async () => {
  for (const name of ["empty-first", "missing-source-first"]) {
    const result = await extractVocabulary(image, { model: gateway(`test/${name}`) });
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[1].originalArabic, "كتاب");
  }
});

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
    (error: unknown) => status(422)(error) && error instanceof Error && /checking twice/.test(error.message),
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
