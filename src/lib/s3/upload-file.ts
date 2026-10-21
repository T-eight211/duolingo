import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getS3BucketName, getS3Client, S3_STORAGE_CLASS } from "./client";

export async function uploadFileToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getS3BucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      StorageClass: S3_STORAGE_CLASS,
    })
  );

  return {
    key: params.key,
  };
}
