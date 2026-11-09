import { stripArabicDiacritics, type VocabularyEntry } from "./schema";

/**
 * Normalizes Arabic text for flexible search (stripping tashkeel, normalizing alif variants, taa marbuta, etc.)
 */
export function normalizeArabicSearch(text: string): string {
  if (!text) return "";
  return stripArabicDiacritics(text)
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\s\-_]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Checks if a vocabulary entry matches the given search query across English and Arabic fields.
 */
export function matchesVocabularySearch(
  word: Pick<VocabularyEntry, "english" | "arabic" | "arabicDiacritized">,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  // 1. English match (case-insensitive substring)
  const qEn = trimmed.toLowerCase();
  if (word.english.toLowerCase().includes(qEn)) {
    return true;
  }

  // 2. Arabic match (with or without tashkeel & unified letter forms)
  const qAr = normalizeArabicSearch(trimmed);
  const wordArNorm = normalizeArabicSearch(word.arabic);
  const wordDiacritizedNorm = normalizeArabicSearch(word.arabicDiacritized || "");

  if (qAr.length > 0 && (wordArNorm.includes(qAr) || wordDiacritizedNorm.includes(qAr))) {
    return true;
  }

  // 3. Raw Arabic substring match (in case user explicitly typed exact diacritics)
  if (
    word.arabic.includes(trimmed) ||
    (word.arabicDiacritized && word.arabicDiacritized.includes(trimmed))
  ) {
    return true;
  }

  return false;
}
