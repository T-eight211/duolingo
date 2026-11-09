/**
 * Utility to strip non-translation annotations, textbook codes, and metadata
 * from English vocabulary translations.
 *
 * Examples:
 *   "first (m)"                    -> "first"
 *   "firsts (m)"                   -> "firsts"
 *   "Turkish (m)"                  -> "Turkish"
 *   "Turkish (m) / Turkish (f)"    -> "Turkish"
 *   "student (m/f)"                -> "student"
 *   "doctor (f.)"                  -> "doctor"
 *   "books (pl.)"                  -> "books"
 *   "book (sing.)"                 -> "book"
 *   "he went (past)"               -> "he went"
 *   "to speak - verb"              -> "to speak"
 *   "doctor [m]"                   -> "doctor"
 *   "beautiful (adj)"              -> "beautiful"
 *   "quickly (adv)"                -> "quickly"
 *   "hello (lit. peace)"           -> "hello"
 *   "good morning (formal)"        -> "good morning"
 *   "big / large"                  -> "big / large" (preserves authentic alternative meanings)
 */

/**
 * Matches parenthesized or bracketed metadata abbreviations/labels:
 * Gender: m, f, masc, fem, masculine, feminine, m/f, f/m
 * Number: s, pl, sing, singular, plur, plural, dual
 * Part of speech: v, verb, n, noun, adj, adjective, adv, adverb, prep, preposition, pron, pronoun
 * Tense/Aspect/Mood: past, present, future, command, imperative, masdar, verbal noun, subjunctive, jussive
 * Pragmatics & Style: lit, literal, literally, fig, figurative, figuratively, formal, informal, colloq, colloquial, slang, archaic
 * Reference/Codes: e.g.*, i.e.*, etc.*, digits, single isolated letters
 */
const METADATA_BRACKETS_REGEX =
  /\s*[\(\[]\s*(?:m|f|s|pl|masc|fem|masculine|feminine|m\/f|f\/m|sing|singular|plur|plural|dual|v|verb|n|noun|adj|adjective|adv|adverb|prep|preposition|pron|pronoun|past|present|future|command|imperative|masdar|verbal noun|subjunctive|jussive|lit\.?|literal(?:ly)?|fig\.?|figurative(?:ly)?|formal|informal|colloq\.?|colloquial|slang|archaic|e\.g\..*?|i\.e\..*?|etc\.?|\d+|[a-z])\.?\s*[\)\]]/gi;

/**
 * Matches explanatory or contextual commentary inside brackets/parentheses, such as:
 * "(lit. ...)", "(meaning ...)", "(used for ...)", "(said to ...)", "(referring to ...)"
 */
const COMMENTARY_BRACKETS_REGEX =
  /\s*[\(\[]\s*(?:lit\.|meaning|used for|said to|referring to|in reference to|denoting).*?[\)\]]/gi;

/**
 * Matches trailing dashes or hyphens followed by grammatical annotations:
 * e.g. "to speak - verb", "he went - past", "doctor - m"
 */
const TRAILING_GRAMMAR_DASH_REGEX =
  /\s*[-–—]\s*(?:verb|noun|past|present|imperative|command|masdar|masculine|feminine|m|f|pl|plural|singular|adj|adjective|adv|adverb|n\.|v\.|adj\.)\b.*$/i;

/**
 * Cleans an English translation string by removing gender notes, grammatical tags,
 * and textbook annotations while preserving legitimate bilingual translation meanings.
 */
export function cleanEnglishTranslation(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw.normalize("NFKC").trim();

  // 1. Remove specific metadata brackets
  text = text.replace(METADATA_BRACKETS_REGEX, "");

  // 2. Remove commentary brackets
  text = text.replace(COMMENTARY_BRACKETS_REGEX, "");

  // 3. Remove trailing grammatical dashes
  text = text.replace(TRAILING_GRAMMAR_DASH_REGEX, "");

  // 4. Normalize alternative translation delimiters to consistent " / ":
  // Convert semicolons to slashes
  text = text.replace(/\s*;\s*/g, " / ");

  // Convert comma-separated alternative translations to " / "
  // e.g. "Colleague, classmate" -> "Colleague / classmate"
  // "read, recite" -> "read / recite"
  if (text.includes(",") && !text.includes("/")) {
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    // When all parts are short translation terms (<= 4 words each)
    const allShort =
      parts.length >= 2 &&
      parts.every((p) => p.split(/\s+/).length <= 4);
    if (allShort) {
      text = parts.join(" / ");
    }
  }

  // 5. Standardize slash spacing: "read/recite" -> "read / recite"
  text = text.replace(/\s*\/\s*/g, " / ");

  // 6. Clean duplicate slash alternatives if created by stripping annotations:
  // e.g. "Turkish / Turkish" -> "Turkish"
  if (text.includes(" / ")) {
    const parts = text.split(" / ").map((p) => p.trim()).filter(Boolean);
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        deduped.push(part);
      }
    }
    text = deduped.join(" / ");
  }

  // 7. Clean leading/trailing punctuation (slashes, dashes, colons, commas)
  text = text.replace(/^[\s\/\-–—,:;]+|[\s\/\-–—,:;]+$/g, "");

  // 8. Collapse internal whitespace
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Returns true if the raw translation contains metadata tags or brackets that should be cleaned.
 */
export function hasEnglishMetadataAnnotation(raw?: string | null): boolean {
  if (!raw) return false;
  return cleanEnglishTranslation(raw) !== raw.trim();
}
