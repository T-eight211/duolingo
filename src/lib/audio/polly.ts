import "server-only";

import crypto from "node:crypto";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";

let cachedPollyClient: PollyClient | null = null;
let cachedS3Client: S3Client | null = null;

function getPollyClient(): PollyClient | null {
  if (cachedPollyClient) return cachedPollyClient;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  cachedPollyClient = new PollyClient({
    region: process.env.AWS_REGION || "eu-west-2",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return cachedPollyClient;
}

function getS3Client(): S3Client | null {
  if (cachedS3Client) return cachedS3Client;
  const endpoint = process.env.SUPABASE_STORAGE_URL;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  cachedS3Client = new S3Client({
    endpoint,
    region: process.env.SUPABASE_STORAGE_REGION || "eu-west-2",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
  return cachedS3Client;
}

export function getPublicAudioUrl(key: string): string {
  const endpoint =
    process.env.SUPABASE_STORAGE_URL ||
    "https://xljjrozfqmuprocuszca.storage.supabase.co/storage/v1/s3";
  const bucket = process.env.S3_BUCKET || "Duolingo Arabic Words Audio";
  const origin = new URL(endpoint).origin;
  return `${origin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${key}`;
}

/**
 * Synthesizes Arabic speech using Amazon Polly (Zeina voice, MSA, standard engine)
 * and uploads the resulting MP3 to Supabase S3 storage.
 */
export async function synthesizeAndUploadWordAudio(
  arabicText: string,
  abortSignal?: AbortSignal,
): Promise<string | null> {
  const trimmed = arabicText.trim();
  if (!trimmed || !/[\u0600-\u06ff]/.test(trimmed)) {
    return null;
  }

  const polly = getPollyClient();
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET || "Duolingo Arabic Words Audio";

  if (!polly || !s3) {
    console.warn(
      "Polly or S3 credentials not fully configured; skipping audio generation.",
    );
    return null;
  }

  // Derive a deterministic filename based on the Arabic text & diacritics
  const hash = crypto
    .createHash("sha256")
    .update(trimmed)
    .digest("hex")
    .slice(0, 20);
  const key = `words/${hash}.mp3`;

  // 1. Check if the audio file already exists in Supabase S3
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { abortSignal },
    );
    return getPublicAudioUrl(key);
  } catch {
    if (abortSignal?.aborted) return null;
    // File does not exist yet; proceed to synthesize
  }

  // 2. Synthesize with Amazon Polly (Zeina, Standard engine, arb)
  try {
    const pollyResponse = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: "standard",
        VoiceId: "Zeina",
        LanguageCode: "arb",
        OutputFormat: "mp3",
        Text: trimmed,
        TextType: "text",
      }),
      { abortSignal },
    );

    if (!pollyResponse.AudioStream) {
      console.warn("Polly response did not contain an AudioStream.");
      return null;
    }

    const audioBytes = await pollyResponse.AudioStream.transformToByteArray();

    // 3. Upload to Supabase S3
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(audioBytes),
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { abortSignal },
    );

    return getPublicAudioUrl(key);
  } catch (err) {
    if (abortSignal?.aborted) return null;
    console.error(`Failed to synthesize audio for "${trimmed}":`, err);
    return null;
  }
}

/**
 * Generates and attaches Polly audio URLs to vocabulary entries.
 * Processes items in parallel with error tolerance so individual failures don't block extraction.
 */
export async function generateVocabularyAudio(
  entries: VocabularyEntry[],
  abortSignal?: AbortSignal,
): Promise<VocabularyEntry[]> {
  const polly = getPollyClient();
  const s3 = getS3Client();
  if (!polly || !s3) return entries;

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      if (entry.audioSrc) return entry;
      const textToSpeak = entry.arabicDiacritized || entry.arabic;
      if (!textToSpeak) return entry;

      try {
        const audioSrc = await synthesizeAndUploadWordAudio(textToSpeak, abortSignal);
        return { ...entry, audioSrc: audioSrc ?? entry.audioSrc ?? null };
      } catch (err) {
        console.error(`Audio generation error for entry "${entry.arabic}":`, err);
        return entry;
      }
    }),
  );

  return results.map((res, index) => {
    if (res.status === "fulfilled") {
      return res.value;
    }
    return entries[index];
  });
}
