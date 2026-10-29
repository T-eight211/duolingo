"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { recordWordPracticeResultAction } from "@/actions/vocabulary";
import { checkTypedAnswer, type AnswerResult } from "./typing-answer";
import type { ExerciseStagePlan } from "./session-plan";

export function TypingExercise({
  stage,
  onAdvance,
}: {
  stage: ExerciseStagePlan;
  onAdvance: (id: string, last: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const incorrectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (incorrectTimer.current !== null) {
        window.clearTimeout(incorrectTimer.current);
      }
    };
  }, []);

  function clearIncorrectTimer() {
    if (incorrectTimer.current === null) return;
    window.clearTimeout(incorrectTimer.current);
    incorrectTimer.current = null;
  }

  function dismissRetryHighlight() {
    clearIncorrectTimer();
    setResult((current) => (current === "incorrect" ? null : current));
  }

  const words = [...stage.initialPairs, ...stage.extraPairs];
  const word = words[index];
  const arabic = stage.type === "type_arabic";
  const expected = arabic ? word.arabic : word.english;
  const tileTextClass = "text-center text-lg font-bold leading-relaxed sm:text-2xl";
  const writtenTextClass = cn(
    "w-full bg-transparent placeholder:text-neutral-300 focus:outline-hidden",
    tileTextClass,
    arabic && "font-arabic",
  );
  const promptTextClass = cn(
    "break-words",
    tileTextClass,
    !arabic && "font-arabic",
  );
  const answerTextClass = cn(
    "break-words",
    tileTextClass,
    arabic && "font-arabic",
  );
  const resolved =
    result === "correct" || result === "missing-vowels" || attempts === 2;

  function submit() {
    clearIncorrectTimer();
    if (resolved) {
      onAdvance(word.id, index === words.length - 1);
      if (index < words.length - 1) setIndex(index + 1);
      setAnswer("");
      setAttempts(0);
      setResult(null);
      return;
    }
    if (!answer.trim()) return;
    const next = checkTypedAnswer(answer, expected, arabic);
    setResult(next);
    setAttempts(attempts + 1);
    if (next === "incorrect") {
      if (attempts === 0) {
        void recordWordPracticeResultAction({
          mistakeWordIds: [word.id],
        }).catch(() => {});
        incorrectTimer.current = window.setTimeout(() => {
          incorrectTimer.current = null;
          setResult((current) => (current === "incorrect" ? null : current));
        }, 700);
      }
    } else if (attempts === 0) {
      void recordWordPracticeResultAction({
        cleanSuccessWordIds: [word.id],
      }).catch(() => {});
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.stopPropagation();
      }}
      className="flex w-full max-w-[600px] flex-col gap-5 px-6 lg:px-0"
    >
      <h1 className="text-center text-lg font-bold text-neutral-700 lg:text-start lg:text-3xl">
        {stage.title}
      </h1>
      <div className="mt-4 grid grid-cols-2 items-stretch gap-3 sm:gap-4" dir="ltr">
        <div className="flex min-h-24 min-w-0 items-center justify-center rounded-xl border-2 border-b-4 bg-white p-3 sm:p-5">
          <p
            lang={arabic ? "en" : "ar"}
            dir={arabic ? "ltr" : "rtl"}
            className={promptTextClass}
          >
            {arabic ? word.english : word.arabic}
          </p>
        </div>
        <div className={cn(
          "flex min-w-0 flex-col justify-center gap-2 rounded-xl border-2 border-b-4 bg-white p-3 sm:p-5",
          result === "missing-vowels" && "border-yellow-400 bg-yellow-50 text-yellow-800",
          result === "correct" && "border-green-500 bg-green-50",
          result === "incorrect" && "border-rose-400 bg-rose-50",
        )}>
          <input
            id="typed-translation"
            key={word.id}
            autoFocus
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              if (result === "incorrect" && !resolved) dismissRetryHighlight();
            }}
            aria-label={arabic ? "Arabic translation" : "English translation"}
            lang={arabic ? "ar" : "en"}
            dir={arabic ? "rtl" : "ltr"}
            autoComplete="off"
            spellCheck={false}
            readOnly={resolved}
            aria-describedby="typing-feedback"
            className={writtenTextClass}
          />
          {(result === "missing-vowels" || (result === "incorrect" && resolved)) && (
            <p lang={arabic ? "ar" : "en"} dir={arabic ? "rtl" : "ltr"} className={answerTextClass}>
              <span className="sr-only">Correct translation: </span>{expected}
            </p>
          )}
        </div>
      </div>
      <div id="typing-feedback" role="status" aria-live="polite" className="sr-only">
        {result === "correct" && "Correct."}
        {result === "missing-vowels" && `Accepted without all vowel marks. Correct translation: ${expected}`}
        {result === "incorrect" && resolved && `Correct translation: ${expected}`}
        {attempts === 1 && !resolved && "Try again. One attempt left."}
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        disabled={!resolved && !answer.trim()}
      >
        {resolved ? "Continue" : "Check"}
      </Button>
    </form>
  );
}
