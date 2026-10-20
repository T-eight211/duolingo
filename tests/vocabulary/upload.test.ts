import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  MAX_UPLOAD_BYTES,
  readVocabularyUpload,
  validateVocabularyUpload,
  VocabularyUploadError,
} from "../../src/lib/vocabulary/upload";

const isUploadError = (status: number) => (error: unknown) =>
  error instanceof VocabularyUploadError && error.status === status;
async function image() {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
}

test("valid images are decoded, normalised and sent without source filenames or metadata", async () => {
  const result = await validateVocabularyUpload(
    new File([await image()], "private-notes.png", { type: "image/png" }),
  );
  assert.equal(result.mediaType, "image/jpeg");
  assert.equal(result.name, "vocabulary.jpg");
  const metadata = await sharp(result.data).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 8);
});

test("empty, oversize, spoofed, corrupt and unsupported uploads are rejected", async () => {
  await assert.rejects(
    validateVocabularyUpload(new File([], "empty.png")),
    isUploadError(400),
  );
  await assert.rejects(
    validateVocabularyUpload(
      new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "large.png"),
    ),
    isUploadError(413),
  );
  await assert.rejects(
    validateVocabularyUpload(
      new File([await image()], "pretend.pdf", { type: "application/pdf" }),
    ),
    isUploadError(415),
  );
  await assert.rejects(
    validateVocabularyUpload(new File(["<script>hello</script>"], "notes.png")),
    isUploadError(415),
  );
  await assert.rejects(
    validateVocabularyUpload(
      new File([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])], "broken.png"),
    ),
    isUploadError(400),
  );
  await assert.rejects(
    validateVocabularyUpload(new File(["%PDF-1.7\n"], "broken.pdf")),
    isUploadError(400),
  );
  await assert.rejects(
    validateVocabularyUpload(
      new File(
        ["%PDF-1.7\n1 0 obj /Encrypt 2 0 R\nendobj\nstartxref\n1\n%%EOF"],
        "locked.pdf",
      ),
    ),
    isUploadError(400),
  );
});

test("multipart endpoint accepts exactly one file and bounds streamed bodies without content-length", async () => {
  const form = new FormData();
  form.append("file", new File([await image()], "notes.png"));
  const result = await readVocabularyUpload(
    new Request("https://example.test/api/vocabulary/extract", {
      method: "POST",
      body: form,
    }),
  );
  assert.equal(result.mediaType, "image/jpeg");
  form.append("file", new File([await image()], "more.png"));
  await assert.rejects(
    readVocabularyUpload(
      new Request("https://example.test", { method: "POST", body: form }),
    ),
    isUploadError(400),
  );
  await assert.rejects(
    readVocabularyUpload(
      new Request("https://example.test", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    ),
    isUploadError(415),
  );
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES + 100_000));
      controller.close();
    },
  });
  await assert.rejects(
    readVocabularyUpload(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=large" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
    isUploadError(413),
  );
});
