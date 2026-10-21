import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";

import { getS3BucketName, getS3Client } from "./client";

async function bodyToBuffer(body: unknown) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in body
  ) {
    const chunks: Buffer[] = [];

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported S3 response body.");
}

export async function getFileFromS3(key: string) {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getS3BucketName(),
      Key: key,
    })
  );
  const body = await bodyToBuffer(response.Body);

  return {
    body,
    contentType: response.ContentType ?? null,
    contentLength: response.ContentLength ?? body.byteLength,
  };
}
