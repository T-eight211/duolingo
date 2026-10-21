import "server-only";

import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export type VocabularyUpload = {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  name: string;
};

export class VocabularyUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "VocabularyUploadError";
  }
}

const IMAGE_OPTIONS = {
  limitInputPixels: 60_000_000,
  failOn: "warning" as const,
};

function detectMediaType(data: Buffer): VocabularyUpload["mediaType"] | null {
  if (data.subarray(0, 5).toString("ascii") === "%PDF-")
    return "application/pdf";
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return "image/jpeg";
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function validateVocabularyUpload(
  file: File,
): Promise<VocabularyUpload> {
  if (file.size === 0)
    throw new VocabularyUploadError(
      "This file is empty. Choose an image or PDF with vocabulary.",
    );
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new VocabularyUploadError("Choose a file smaller than 20 MB.", 413);
  }

  const data = Buffer.from(await file.arrayBuffer());
  const mediaType = detectMediaType(data);
  if (!mediaType) {
    throw new VocabularyUploadError(
      "Use a JPEG, PNG, WebP image or a PDF document.",
      415,
    );
  }
  // Empty and generic MIME values are common for mobile camera/file pickers.
  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    file.type !== mediaType
  ) {
    throw new VocabularyUploadError(
      "This file's contents do not match its file type. Export it again and retry.",
      415,
    );
  }

  if (mediaType === "application/pdf") {
    const pdfText = data.toString("latin1");
    if (
      !/%%EOF\s*$/.test(pdfText) ||
      !/startxref\s+\d+/.test(pdfText) ||
      !/\d+\s+\d+\s+obj\b/.test(pdfText)
    ) {
      throw new VocabularyUploadError(
        "This PDF appears incomplete or damaged. Export it again and retry.",
      );
    }
    if (/\/Encrypt\b/.test(pdfText)) {
      throw new VocabularyUploadError(
        "This PDF is password protected. Upload an unlocked copy.",
      );
    }
    return { data, mediaType, name: "vocabulary.pdf" };
  }

  try {
    const metadata = await sharp(data, IMAGE_OPTIONS).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      throw new Error("Invalid or animated image");
    }
    // Decode the entire image to reject damaged uploads, honour camera orientation,
    // and remove location/other metadata before sending the image to the model.
    const image = await sharp(data, IMAGE_OPTIONS)
      .rotate()
      .resize({
        width: 3000,
        height: 3000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { data: image, mediaType: "image/jpeg", name: "vocabulary.jpg" };
  } catch {
    throw new VocabularyUploadError(
      "This image could not be read. Use a clear, still image.",
    );
  }
}

/** Enforce the size limit while reading, even when Content-Length is absent. */
export async function readVocabularyUpload(
  request: Request,
): Promise<VocabularyUpload> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    throw new VocabularyUploadError(
      "Upload an image or PDF using the file picker.",
      415,
    );
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length <= 0)
      throw new VocabularyUploadError("The upload is empty or invalid.");
    if (length > MAX_UPLOAD_REQUEST_BYTES)
      throw new VocabularyUploadError("Choose a file smaller than 20 MB.", 413);
  }
  if (!request.body)
    throw new VocabularyUploadError("Choose an image or PDF to upload.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_REQUEST_BYTES) {
        await reader.cancel();
        throw new VocabularyUploadError(
          "Choose a file smaller than 20 MB.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size)
    throw new VocabularyUploadError("Choose an image or PDF to upload.");

  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new VocabularyUploadError(
      "The upload could not be read. Choose the file again.",
    );
  }
  const files = form.getAll("file");
  if (
    files.length !== 1 ||
    !(files[0] instanceof File) ||
    Array.from(form.keys()).some((key) => key !== "file")
  ) {
    throw new VocabularyUploadError("Choose one image or PDF at a time.");
  }
  return validateVocabularyUpload(files[0]);
}
