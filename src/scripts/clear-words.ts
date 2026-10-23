import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3Client,
} from "@aws-sdk/client-s3";

async function main() {
  console.log("=== Clearing Vocabulary Data & S3 Audio ===");

  // 1. Clear S3 Audio Files
  const endpoint = process.env.SUPABASE_STORAGE_URL;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET || "Duolingo Arabic Words Audio";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn("⚠️ S3 credentials not fully configured; skipping S3 deletion.");
  } else {
    console.log(`Connecting to S3 bucket '${bucket}' at ${endpoint}...`);
    const s3 = new S3Client({
      endpoint,
      region: process.env.SUPABASE_STORAGE_REGION || "eu-west-2",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    let totalDeleted = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const listRes: ListObjectsV2CommandOutput = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: "words/",
          ContinuationToken: continuationToken,
        }),
      );

      const objects = listRes.Contents ?? [];
      if (objects.length > 0) {
        const keysToDelete: string[] = objects
          .map((obj) => obj.Key)
          .filter((k): k is string => Boolean(k));

        if (keysToDelete.length > 0) {
          console.log(`Deleting batch of ${keysToDelete.length} objects from S3...`);
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: keysToDelete.map((Key) => ({ Key })),
                Quiet: true,
              },
            }),
          );
          totalDeleted += keysToDelete.length;
        }
      }

      continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
    } while (continuationToken);

    console.log(`✅ Successfully deleted ${totalDeleted} audio files from S3 bucket '${bucket}'.`);
  }

  // 2. Clear Database Vocabulary
  const { client } = await import("../db/drizzle");
  console.log("\nConnecting to database to clear vocabulary tables...");

  await client.begin(async (tx) => {
    const deletedLinks = await tx`DELETE FROM public.user_vocabulary_links RETURNING *`;
    console.log(`Deleted ${deletedLinks.length} rows from public.user_vocabulary_links.`);

    const deletedVocab = await tx`DELETE FROM public.user_vocabulary RETURNING *`;
    console.log(`Deleted ${deletedVocab.length} rows from public.user_vocabulary.`);
  });

  // 3. Verification
  const remainingVocab = await client`SELECT count(*) FROM public.user_vocabulary`;
  const remainingLinks = await client`SELECT count(*) FROM public.user_vocabulary_links`;

  console.log("\n=== Verification ===");
  console.log(`Remaining user_vocabulary rows: ${remainingVocab[0].count}`);
  console.log(`Remaining user_vocabulary_links rows: ${remainingLinks[0].count}`);

  if (endpoint && accessKeyId && secretAccessKey) {
    const s3 = new S3Client({
      endpoint,
      region: process.env.SUPABASE_STORAGE_REGION || "eu-west-2",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    const verifyList = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "words/",
      }),
    );
    console.log(`Remaining S3 objects in '${bucket}': ${verifyList.KeyCount ?? 0}`);
  }

  await client.end();
  console.log("\n🎉 Database and S3 are completely cleared! You can now add words fresh from scratch.");
}

main().catch((err) => {
  console.error("❌ Failed to clear words:", err);
  process.exitCode = 1;
});
