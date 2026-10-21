import "server-only";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getS3BucketName, getS3Client } from "./client";

export async function deleteFileFromS3(key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getS3BucketName(),
      Key: key,
    })
  );
}
