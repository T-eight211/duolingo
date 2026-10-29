export type AnswerResult = "correct" | "missing-vowels" | "incorrect";

const marks = /[\u064b-\u0652\u0670]/g;
const normalizeArabic = (text: string) =>
  text
    .normalize("NFC")
    .replace(/\u0640/g, "")
    .trim()
    .replace(/\s+/g, " ");
const normalizeEnglish = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");

export function checkTypedAnswer(
  answer: string,
  expected: string,
  arabic: boolean,
): AnswerResult {
  if (!answer.trim()) return "incorrect";
  if (!arabic)
    return normalizeEnglish(answer) === normalizeEnglish(expected)
      ? "correct"
      : "incorrect";
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
