import { createHash } from "node:crypto";

import {
  deduplicateVocabularyEntries,
  vocabularyKey,
  type VocabularyEntry,
} from "@/lib/vocabulary/schema";

export const vocabularyStorageKey = (entry: VocabularyEntry) =>
  createHash("sha256").update(vocabularyKey(entry)).digest("hex");

/** Resolve upload-local relationships before replacing IDs with database IDs. */
export function prepareVocabularySave(entries: VocabularyEntry[]) {
  const { entries: uniqueEntries } = deduplicateVocabularyEntries(entries);
  const inputById = new Map(entries.map((entry) => [entry.id, entry]));
  const links = new Map<string, { sourceKey: string; wordKey: string }>();

  // Use the original graph so aliases of duplicate sentences retain every word.
  for (const entry of entries) {
    if (entry.kind !== "word") continue;

    const wordKey = vocabularyStorageKey(entry);
    for (const sourceId of entry.sourceIds) {
      const source = inputById.get(sourceId);
      // Removed parents are intentionally not recreated or linked across uploads.
      if (!source || source.kind === "word") continue;

      const sourceKey = vocabularyStorageKey(source);
      links.set(`${sourceKey}:${wordKey}`, { sourceKey, wordKey });
    }
  }

  return {
    entries: uniqueEntries.map((entry) => ({
      ...entry,
      normalizedKey: vocabularyStorageKey(entry),
    })),
    links: [...links.values()],
  };
}
