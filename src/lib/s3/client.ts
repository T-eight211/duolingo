import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

export const S3_STORAGE_CLASS = "INTELLIGENT_TIERING" as const;

let s3Client: S3Client | null = null;
let bucketName: string | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getS3BucketName() {
  if (!bucketName) {
    bucketName = getRequiredEnv("AWS_S3_BUCKET");
  }

  return bucketName;
}

export function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRequiredEnv("AWS_REGION"),
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }

  return s3Client;
}
