import { cleanEnglishTranslation } from "@/lib/vocabulary/clean-translation";

export type AnswerResult = "correct" | "missing-vowels" | "incorrect";

const marks = /[\u064b-\u0652\u0670]/g;
const normalizeArabic = (text: string) =>
  text
    .normalize("NFC")
    .replace(/\u0640/g, "")
    .trim()
    .replace(/\s+/g, " ");

export const normalizeEnglish = (text: string) =>
  cleanEnglishTranslation(text)
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[\(\[][^\)\]]*[\)\]]/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripVerbTo = (text: string) => text.replace(/^to\s+/i, "").trim();

export function checkTypedAnswer(
  answer: string,
  expected: string,
  arabic: boolean,
): AnswerResult {
  if (!answer.trim()) return "incorrect";
  if (!arabic) {
    const normAns = normalizeEnglish(answer);
    const normAnsNoTo = stripVerbTo(normAns);
    const normExp = normalizeEnglish(expected);

    // 1. Direct match (with or without optional "to" for verbs)
    if (normAns === normExp || normAnsNoTo === stripVerbTo(normExp)) {
      return "correct";
    }

    // 2. Multi-alternative matching (split by '/', ',', ';', or ' or ')
    // e.g. "Colleague / classmate", "read, recite", "big or large"
    const rawAlternatives = expected.split(/\s*(?:\/|,|;|\bor\b)\s*/);
    const validAlternatives = new Set<string>();

    for (const alt of rawAlternatives) {
      const cleanAlt = normalizeEnglish(alt);
      if (cleanAlt) {
        validAlternatives.add(cleanAlt);
        validAlternatives.add(stripVerbTo(cleanAlt));
      }
    }

    if (validAlternatives.has(normAns) || validAlternatives.has(normAnsNoTo)) {
      return "correct";
    }

    // Support user typing multiple alternatives together (e.g. "colleague or classmate", "read / recite")
    const userAlternatives = normAns.split(/\s*(?:\/|,|;|\bor\b)\s*/);
    if (
      userAlternatives.length > 1 &&
      userAlternatives.every(
        (a) =>
          validAlternatives.has(a) || validAlternatives.has(stripVerbTo(a)),
      )
    ) {
      return "correct";
    }

    return "incorrect";
  }
  const actual = normalizeArabic(answer);
  const target = normalizeArabic(expected);
  if (actual === target) return "correct";
  if (actual.replace(marks, "") !== target.replace(marks, ""))
    return "incorrect";
  // Omitted marks are allowed, but supplied marks must agree at each letter.
  const clusters = (text: string) =>
    text.match(/[^\u064b-\u0652\u0670][\u064b-\u0652\u0670]*/g) ?? [];
  const targets = clusters(target);
  const valid = clusters(actual).every((cluster, index) =>
    [...cluster.slice(1)].every((mark) =>
      targets[index]?.slice(1).includes(mark),
    ),
  );
  return valid ? "missing-vowels" : "incorrect";
}
