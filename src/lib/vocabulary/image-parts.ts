import "server-only";

import sharp from "sharp";
import type { FilePart, ImagePart } from "ai";
import type { VocabularyUpload } from "./upload";

/** Full-page context plus overlapping full-width reading bands for dense photos. */
export async function vocabularyImageParts(upload: VocabularyUpload): Promise<(ImagePart | FilePart)[]> {
  if (upload.mediaType === "application/pdf") {
    return [{ type: "file", data: upload.data, mediaType: upload.mediaType, filename: upload.name }];
  }
  const image = (data: Uint8Array): ImagePart => ({
    type: "image", image: data, mediaType: upload.mediaType,
    providerOptions: { openai: { imageDetail: "high" } },
  });
  const parts: ImagePart[] = [image(upload.data)];
  const { width, height } = await sharp(upload.data).metadata();
  if (!width || !height || height < 1400 || height < width) return parts;
  const overlap = Math.ceil(height * 0.04);
  for (let band = 0; band < 3; band++) {
    const top = Math.max(0, Math.floor(height * band / 3) - overlap);
    const bottom = Math.min(height, Math.ceil(height * (band + 1) / 3) + overlap);
    const data = await sharp(upload.data).extract({ left: 0, top, width, height: bottom - top }).toBuffer();
    parts.push(image(data));
  }
  return parts;
}
