import { z } from "zod";

import { arabicGrammarSchema } from "@/lib/grammar/schema";
import type { ArabicGrammar, PartOfSpeech } from "@/lib/grammar/types";

export const MAX_EXTRACTION_ENTRIES = 100;
export const vocabularyKindSchema = z.enum(["word", "phrase", "sentence"]);
export const correctionSchema = z.enum([
  "arabic_spelling",
  "english_spelling",
  "translation",
  "diacritics",
]);

// Extraction can leave an uncertain translation blank for the user to supply.
// Saving applies stricter language/content checks below.
export const rawExtractionEntrySchema = z.object({
  id: z.string().min(1).max(100),
  kind: vocabularyKindSchema,
  arabic: z.string().trim().max(2000),
  arabicDiacritized: z.string().trim().max(2400),
  english: z.string().trim().max(2400),
  originalArabic: z.string().max(4000).nullable(),
  originalEnglish: z.string().max(4000).nullable(),
  corrections: z.array(correctionSchema).max(4),
  needsReview: z.boolean(),
  reviewReason: z.string().max(1000).nullable(),
  sourceIds: z.array(z.string().min(1).max(100)).max(MAX_EXTRACTION_ENTRIES),
});

export const rawExtractionResultSchema = z.object({
  entries: z.array(rawExtractionEntrySchema).max(MAX_EXTRACTION_ENTRIES),
  warnings: z.array(z.string().max(1000)).max(10),
});

export const vocabularyEntrySchema = rawExtractionEntrySchema.extend({
  partOfSpeech: z.enum(["noun", "verb", "particle"]).nullable().optional(),
  grammar: z.any().nullable().optional(),
  audioSrc: z.string().nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
});

export const extractionResultSchema = z.object({
  entries: z.array(vocabularyEntrySchema).max(MAX_EXTRACTION_ENTRIES),
  warnings: z.array(z.string().max(1000)).max(10),
});

export type RawExtractionEntry = z.infer<typeof rawExtractionEntrySchema>;
export type VocabularyEntry = z.infer<typeof vocabularyEntrySchema>;
export type ExtractionResult = {
  entries: VocabularyEntry[];
  warnings: string[];
};

export function createEmptyVocabularyEntry(): VocabularyEntry {
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    kind: "word",
    arabic: "",
    arabicDiacritized: "",
    english: "",
    originalArabic: null,
    originalEnglish: null,
    corrections: [],
    needsReview: false,
    reviewReason: null,
    sourceIds: [],
    partOfSpeech: null,
    grammar: null,
    audioSrc: null,
    category: null,
  };
}

export function stripArabicDiacritics(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/\u0640/g, "");
}

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeArabic(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\u0640/g, "")
    .replace(
      /([\u0600-\u06ff])([\u064b-\u065f\u0670]+)/g,
      (_match, base, diacritics) => {
        return base + Array.from(diacritics).sort().join("");
      },
    )
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function vocabularyKey(
  entry: Pick<
    VocabularyEntry,
    "kind" | "arabic" | "arabicDiacritized" | "english"
  >,
): string {
  const arabicText = entry.arabicDiacritized?.trim() || entry.arabic?.trim() || "";
  return JSON.stringify([
    entry.kind,
    canonicalizeArabic(arabicText),
  ]);
}

/** Keep sentence links when repeated words collapse into one review entry. */
export function deduplicateVocabularyEntries(input: VocabularyEntry[]): {
  entries: VocabularyEntry[];
  duplicates: number;
} {
  const byKey = new Map<string, VocabularyEntry>();
  const remappedIds = new Map<string, string>();
  for (const entry of input) {
    const key = vocabularyKey(entry);
    const existing = byKey.get(key);
    if (existing) {
      remappedIds.set(entry.id, existing.id);
      existing.sourceIds.push(...entry.sourceIds);
      existing.corrections = [
        ...new Set([...existing.corrections, ...entry.corrections]),
      ];
      existing.needsReview ||= entry.needsReview;
      existing.reviewReason ||= entry.reviewReason;
      existing.originalArabic ||= entry.originalArabic;
      existing.originalEnglish ||= entry.originalEnglish;
      existing.partOfSpeech ||= entry.partOfSpeech;
      existing.grammar ||= entry.grammar;
      existing.audioSrc ||= entry.audioSrc;
    } else {
      byKey.set(key, {
        ...entry,
        sourceIds: [...entry.sourceIds],
        corrections: [...entry.corrections],
      });
      remappedIds.set(entry.id, entry.id);
    }
  }
  const entries = [...byKey.values()];
  const sources = new Set(
    entries.filter((entry) => entry.kind !== "word").map((entry) => entry.id),
  );
  for (const entry of entries) {
    entry.sourceIds =
      entry.kind === "word"
        ? [
            ...new Set(entry.sourceIds.map((id) => remappedIds.get(id) ?? id)),
          ].filter((id) => sources.has(id) && id !== entry.id)
        : [];
  }
  return { entries, duplicates: input.length - entries.length };
}

export const saveVocabularySchema = z
  .object({
    category: z.string().trim().max(100).nullable().optional(),
    entries: z
      .array(vocabularyEntrySchema)
      .min(1, "Add at least one entry.")
      .max(MAX_EXTRACTION_ENTRIES),
  })
  .superRefine(({ entries }, ctx) => {
    const ids = new Set<string>();
    const sourceIds = new Set(
      entries.filter((entry) => entry.kind !== "word").map((entry) => entry.id),
    );
    for (const [index, entry] of entries.entries()) {
      if (ids.has(entry.id))
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "id"],
          message: "Entry IDs must be unique.",
        });
      ids.add(entry.id);
      for (const field of ["arabic", "arabicDiacritized"] as const) {
        if (
          !/[\u0621-\u063a\u0641-\u064a\u066e-\u066f\u0671-\u06d3]/u.test(
            entry[field],
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["entries", index, field],
            message: "Enter an Arabic word or sentence.",
          });
        }
      }
      if (
        normalizeText(stripArabicDiacritics(entry.arabic)) !==
        normalizeText(stripArabicDiacritics(entry.arabicDiacritized))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "arabicDiacritized"],
          message: "The Arabic text and its diacritised version must match.",
        });
      }
      if (!/[a-z]/i.test(entry.english))
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "english"],
          message: "Enter an English translation.",
        });
      if (
        entry.sourceIds.some(
          (id) => entry.kind !== "word" || !sourceIds.has(id),
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "sourceIds"],
          message: "A linked sentence or phrase is missing.",
        });
      }
    }
  });
export type SaveVocabularyInput = z.infer<typeof saveVocabularySchema>;
