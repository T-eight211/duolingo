import "server-only";

import { CopyObjectCommand } from "@aws-sdk/client-s3";

import { getS3BucketName, getS3Client, S3_STORAGE_CLASS } from "./client";

function encodeCopySource(key: string) {
  const bucketName = getS3BucketName();

  return `${bucketName}/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export async function copyFileInS3(params: {
  sourceKey: string;
  destinationKey: string;
  contentType?: string | null;
}) {
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: getS3BucketName(),
      Key: params.destinationKey,
      CopySource: encodeCopySource(params.sourceKey),
      StorageClass: S3_STORAGE_CLASS,
      ...(params.contentType
        ? {
            ContentType: params.contentType,
            MetadataDirective: "REPLACE" as const,
          }
        : {}),
    })
  );

  return {
    key: params.destinationKey,
  };
}
