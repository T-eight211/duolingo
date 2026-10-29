import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { vocabularyImageParts } from "../../src/lib/vocabulary/image-parts";

test("dense pages retain full context and overlapping full-width bands through the last row", async () => {
  const width = 1000;
  const height = 1800;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    pixels.fill(Math.floor(y / 10), y * width * 3, (y + 1) * width * 3);
  }
  const data = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const parts = await vocabularyImageParts({ data, name: "page.png", mediaType: "image/png" });
  assert.equal(parts.length, 4);
  const ranges: number[][] = [];
  for (const part of parts.slice(1)) {
    assert.equal(part.type, "image");
    if (part.type !== "image") throw new Error("Expected image");
    const { data: decoded, info } = await sharp(part.image as Buffer).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, width, "Both table blocks must remain together");
    ranges.push([decoded[0], decoded[decoded.length - 1]]);
  }
  assert.equal(ranges[0][0], 0);
  assert.equal(ranges[2][1], 179, "The final row must be included");
  assert.ok(ranges[0][1] > ranges[1][0]);
  assert.ok(ranges[1][1] > ranges[2][0]);
});

test("small images and PDFs do not receive redundant crops", async () => {
  const data = await sharp({ create: { width: 50, height: 100, channels: 3, background: "white" } }).png().toBuffer();
  assert.equal((await vocabularyImageParts({ data, name: "small.png", mediaType: "image/png" })).length, 1);
  const pdf = { data: Buffer.from("%PDF-1.7"), name: "notes.pdf", mediaType: "application/pdf" as const };
  assert.deepEqual(await vocabularyImageParts(pdf), [{ type: "file", data: pdf.data, mediaType: pdf.mediaType, filename: pdf.name }]);
});
