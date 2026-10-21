import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3BucketName, getS3Client, S3_STORAGE_CLASS } from "./client";

const DEFAULT_UPLOAD_EXPIRES_IN_SECONDS = 60 * 3;
const DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS = 60 * 5;

export async function getPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength?: number;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: getS3BucketName(),
    Key: params.key,
    ContentType: params.contentType,
    StorageClass: S3_STORAGE_CLASS,
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: params.expiresIn ?? DEFAULT_UPLOAD_EXPIRES_IN_SECONDS,
  });
}

export async function getPresignedDownloadUrl(params: {
  key: string;
  expiresIn?: number;
  method?: "GET" | "HEAD";
  downloadFileName?: string;
}) {
  const command =
    params.method === "HEAD"
      ? new HeadObjectCommand({
          Bucket: getS3BucketName(),
          Key: params.key,
        })
      : new GetObjectCommand({
          Bucket: getS3BucketName(),
          Key: params.key,
          ...(params.downloadFileName
            ? { ResponseContentDisposition: `attachment; filename="${params.downloadFileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"` }
            : {}),
        });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: params.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS,
  });
}
