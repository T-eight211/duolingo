"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, CheckCircle, Sparkles, Volume2, X, XCircle } from "lucide-react";
import { useKey, useMedia, useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import styles from "./matching-exercise.module.css";
import { cn } from "@/lib/utils";

const pairs = [
  { id: "fish", english: "fish", arabic: "سَمَك" },
  { id: "smart", english: "smart", arabic: "ذَكِيّ" },
  { id: "she", english: "she", arabic: "هِيَ" },
  { id: "fast", english: "fast", arabic: "سَرِيع" },
  { id: "where", english: "where", arabic: "أَيْنَ" },
];
const arabicPairs = [pairs[1], pairs[4], pairs[0], pairs[3], pairs[2]];
const extraPairs = [
  { id: "he", english: "he", arabic: "هُوَ" },
  { id: "room", english: "room", arabic: "غُرْفَة" },
  { id: "neighbor", english: "neighbor", arabic: "جَار" },
  { id: "book", english: "book", arabic: "كِتَاب" },
  { id: "cold", english: "cold", arabic: "بَارِد" },
];
const listeningPairs = [
  { id: "weird", english: "weird", arabic: "غَرِيب" },
  { id: "blue", english: "blue", arabic: "أَزْرَق" },
  { id: "father", english: "father", arabic: "أَب" },
  { id: "tshirt", english: "t-shirt", arabic: "تِي شِيرْت" },
  { id: "brown", english: "brown", arabic: "بُنِّيّ" },
];
const listeningExtras = [
  { id: "university", english: "university", arabic: "جَامِعَة" },
  { id: "he", english: "he", arabic: "هُوَ" },
  { id: "sister", english: "sister", arabic: "أُخْت" },
  { id: "white", english: "white", arabic: "أَبْيَض" },
  { id: "daughter", english: "daughter", arabic: "بِنْت" },
];
const listeningOrder = [
  listeningPairs[2],
  listeningPairs[0],
  listeningPairs[4],
  listeningPairs[1],
  listeningPairs[3],
];
const waveform = [5, 12, 22, 30, 25, 38, 29, 21, 13, 20, 12, 8, 5];
type Side = "english" | "arabic";
type Feedback = { english: string; arabic: string; correct: boolean };

export function MatchingExercise() {
  const router = useRouter();
  const isMobile = useMedia("(max-width: 1024px)");
  const { width, height } = useWindowSize();

  const [motion, setMotion] = useState<{
    phase: "leaving" | "entering";
    ids: string[];
  } | null>(null);
  const [exercise, setExercise] = useState<1 | 2 | 3>(3);
  const [intermission, setIntermission] = useState(false);
  const [listeningSkipped, setListeningSkipped] = useState(false);
  const [finishedMatches, setFinishedMatches] = useState(0);
  const [englishSlots, setEnglishSlots] = useState(listeningPairs);
  const [arabicSlots, setArabicSlots] = useState(listeningOrder);
  const [english, setEnglish] = useState<string | null>(null);
  const [arabic, setArabic] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const stepIndex = exercise === 3 ? 0 : exercise === 1 ? 1 : 2;
  const totalPairs =
    exercise > 1 ? pairs.length + extraPairs.length : pairs.length;
  const sessionMatched = finishedMatches + matched.length;
  const complete = exercise === 2 && matched.length === totalPairs && !feedback;

  const currentFraction = totalPairs > 0 ? matched.length / totalPairs : 0;
  const overallPercentage = Math.min(
    100,
    complete
      ? 100
      : Math.round(((stepIndex + currentFraction) / 3) * 100),
  );

  useEffect(() => {
    if (!feedback) return;
    const advance =
      exercise !== 2 && feedback.correct && matched.length === totalPairs;
    const replacement =
      exercise > 1 && feedback.correct
        ? (exercise === 3 ? listeningExtras : extraPairs)[matched.length - 1]
        : undefined;
    const animate = advance || !!replacement;
    const timers: number[] = [];
    const clearSelection = () => {
      setFeedback(null);
      setEnglish(null);
      setArabic(null);
    };
    if (animate) {
      timers.push(
        window.setTimeout(() => {
          setMotion({
            phase: "leaving",
            ids: advance
              ? [
                  ...pairs,
                  ...extraPairs,
                  ...listeningPairs,
                  ...listeningExtras,
                ].map((pair) => pair.id)
              : [feedback.english],
          });
        }, 400),
      );
    }
    timers.push(
      window.setTimeout(
        () => {
          if (advance) {
            setIntermission(true);
            setMotion(null);
          } else if (replacement) {
            setEnglishSlots((slots) =>
              slots.map((pair) =>
                pair.id === feedback.english ? replacement : pair,
              ),
            );
            setArabicSlots((slots) =>
              slots.map((pair) =>
                pair.id === feedback.arabic ? replacement : pair,
              ),
            );
            setMotion({ phase: "entering", ids: [replacement.id] });
          }
          clearSelection();
        },
        animate ? 1050 : feedback.correct ? 650 : 1000,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [feedback, exercise, matched.length, totalPairs]);

  useEffect(() => {
    if (motion?.phase !== "entering") return;
    const timer = window.setTimeout(() => setMotion(null), 650);
    return () => window.clearTimeout(timer);
  }, [motion]);

  function select(side: Side, id: string) {
    if (feedback || motion || intermission || matched.includes(id)) return;
    const nextEnglish =
      side === "english" ? (english === id ? null : id) : english;
    const nextArabic = side === "arabic" ? (arabic === id ? null : id) : arabic;
    setEnglish(nextEnglish);
    setArabic(nextArabic);
    if (nextEnglish && nextArabic) {
      const correct = nextEnglish === nextArabic;
      setFeedback({ english: nextEnglish, arabic: nextArabic, correct });
      if (correct) setMatched((current) => [...current, nextEnglish]);
    }
  }

  function continueExercise() {
    setFinishedMatches((count) => count + matched.length);
    setExercise(exercise === 3 ? 1 : 2);
    setEnglishSlots(pairs);
    setArabicSlots(arabicPairs);
    setMatched([]);
    setFeedback(null);
    setEnglish(null);
    setArabic(null);
    setIntermission(false);
    setMotion({ phase: "entering", ids: pairs.map((pair) => pair.id) });
  }

  function skipListening() {
    setListeningSkipped(true);
    continueExercise();
  }

  function reset() {
    setMotion(null);
    setIntermission(false);
    setListeningSkipped(false);
    setFinishedMatches(0);
    setExercise(3);
    setEnglishSlots(listeningPairs);
    setArabicSlots(listeningOrder);
    setEnglish(null);
    setArabic(null);
    setMatched([]);
    setFeedback(null);
  }

  useKey("Enter", () => {
    if (intermission) {
      continueExercise();
    } else if (complete) {
      router.push("/practice/words");
    }
  });

  function tile(pair: (typeof pairs)[number], side: Side, index: number) {
    const isAudio = exercise === 3 && side === "arabic";
    const isMatched = matched.includes(pair.id);
    const isSelected = (side === "english" ? english : arabic) === pair.id;
    const result = feedback?.[side] === pair.id ? feedback : null;
    const showWave = isAudio && !isMatched;
    return (
      <button
        key={pair.id}
        type="button"
        onClick={() => select(side, pair.id)}
        disabled={isMatched || !!feedback || !!motion}
        aria-pressed={isSelected}
        aria-label={
          showWave
            ? `Play audio ${index + 1}`
            : `${pair[side]}${isMatched ? ", matched" : ""}`
        }
        lang={side === "arabic" && !showWave ? "ar" : "en"}
        dir={side === "arabic" && !showWave ? "rtl" : "ltr"}
        className={cn(
          styles.tile,
          motion?.ids.includes(pair.id) &&
            (motion.phase === "leaving" ? styles.leaving : styles.entering),
          "relative flex h-[72px] w-full items-center justify-center rounded-xl border-2 border-b-4 bg-white px-3 text-lg font-bold text-neutral-700 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:h-[84px] sm:text-xl",
          side === "arabic" && "text-2xl sm:text-3xl font-medium",
          !isMatched && !feedback && "hover:bg-slate-50 active:border-b-2",
          showWave && "text-sky-500",
          isSelected && "border-sky-400 bg-sky-50 text-sky-600",
          isMatched && !result && "border-slate-200 bg-slate-50 text-slate-300",
          result?.correct && "border-green-500 bg-green-50 text-green-600",
          result &&
            !result.correct &&
            "border-rose-400 bg-rose-50 text-rose-500",
        )}
      >
        {showWave ? (
          <span
            className="flex w-full max-w-[170px] items-center justify-center gap-3"
            aria-hidden="true"
          >
            <span className="flex h-10 min-w-0 flex-1 items-center justify-between gap-0.5">
              {waveform.map((height, bar) => (
                <span
                  key={bar}
                  className="w-1 rounded-full bg-current sm:w-1.5"
                  style={{ height }}
                />
              ))}
            </span>
            <Volume2 className="h-6 w-6 shrink-0" />
          </span>
        ) : (
          pair[side]
        )}
        {isMatched && (
          <Check
            aria-hidden="true"
            className="absolute right-2 top-2 h-3.5 w-3.5"
          />
        )}
        {result && !result.correct && (
          <X
            aria-hidden="true"
            className="absolute right-2 top-2 h-3.5 w-3.5"
          />
        )}
      </button>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-white">
      {complete && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          tweenDuration={1000}
        />
      )}

      {/* Top Header - Matches Lesson Page Header */}
      <header className="mx-auto flex w-full max-w-[1140px] items-center justify-between gap-x-7 px-6 pt-[20px] lg:px-10 lg:pt-[50px]">
        <Link
          href="/practice/words"
          className="cursor-pointer text-slate-500 transition hover:opacity-75"
          aria-label="Exit word practice"
        >
          <X className="h-6 w-6 stroke-[2.5]" />
        </Link>
        <Progress value={overallPercentage} className="h-3 lg:h-4 flex-1" />
        <div className="flex items-center gap-x-1.5 font-bold text-sky-500 text-sm lg:text-base">
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">Practice</span>
        </div>
      </header>

      {/* Main Body - Matches Lesson Page Content Width and Centering */}
      <main className="flex flex-1 flex-col items-center justify-center py-6">
        {intermission ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="flex max-w-[500px] items-center justify-center gap-4 sm:gap-8">
              <div className="relative rounded-2xl border-2 bg-white p-5 shadow-sm sm:p-7">
                <h1 className="text-xl font-bold leading-relaxed text-neutral-700 sm:text-2xl">
                  {exercise === 3
                    ? "Great job! Let’s match some words next."
                    : "Great job! Let’s make it a bit harder…"}
                </h1>
                <span
                  aria-hidden="true"
                  className="absolute right-[-9px] top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-r-2 border-t-2 bg-white"
                />
              </div>
              <Image
                src="/mascot.svg"
                alt="Cheering mascot"
                width={140}
                height={140}
                className="h-24 w-24 shrink-0 -rotate-12 sm:h-36 sm:w-36"
              />
            </div>
          </div>
        ) : complete ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-y-4 px-6 text-center">
            <Image
              src="/finish.svg"
              alt="finish"
              height={100}
              width={100}
              className="hidden lg:block"
            />
            <Image
              src="/finish.svg"
              alt="finish"
              height={60}
              width={60}
              className="block lg:hidden"
            />
            <h1 className="text-xl font-bold text-neutral-700 lg:text-3xl">
              Nicely done! <br /> You&apos;ve completed the practice session.
            </h1>
            <p className="text-sm text-muted-foreground lg:text-base">
              {listeningSkipped
                ? "Practice complete. Listening was skipped."
                : `You matched all ${sessionMatched} words in this practice.`}
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-y-3 px-6 lg:min-h-[350px] lg:w-[600px] lg:px-0">
            <h1 className="text-center text-lg font-bold text-neutral-700 lg:text-start lg:text-3xl">
              Tap the matching pairs
            </h1>
            <p className="text-center text-sm text-muted-foreground lg:text-start">
              {exercise === 3
                ? "Match each audio clip with its English translation."
                : exercise === 2
                  ? "Match the pairs to reveal new words. Keep going until all 10 are matched."
                  : "Match each English word with its Arabic translation."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4" dir="ltr">
              <div
                className="flex flex-col gap-3 sm:gap-4"
                role="group"
                aria-label={exercise === 3 ? "Arabic audio" : "English words"}
              >
                {exercise === 3
                  ? arabicSlots.map((pair, index) =>
                      tile(pair, "arabic", index),
                    )
                  : englishSlots.map((pair, index) =>
                      tile(pair, "english", index),
                    )}
              </div>
              <div
                className="flex flex-col gap-3 sm:gap-4"
                role="group"
                aria-label={exercise === 3 ? "English words" : "Arabic words"}
              >
                {exercise === 3
                  ? englishSlots.map((pair, index) =>
                      tile(pair, "english", index),
                    )
                  : arabicSlots.map((pair, index) =>
                      tile(pair, "arabic", index),
                    )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Footer - Matches Lesson Page Footer */}
      <footer
        className={cn(
          "h-[100px] border-t-2 lg:h-[140px] transition-colors",
          feedback?.correct && "border-transparent bg-green-100",
          feedback && !feedback.correct && "border-transparent bg-rose-100",
        )}
      >
        <div className="mx-auto flex h-full max-w-[1140px] items-center justify-between px-6 lg:px-10">
          {feedback?.correct && (
            <div className="flex items-center text-base font-bold text-green-500 lg:text-2xl">
              <CheckCircle className="mr-4 h-6 w-6 lg:h-10 lg:w-10" />
              Nicely done!
            </div>
          )}
          {feedback && !feedback.correct && (
            <div className="flex items-center text-base font-bold text-rose-500 lg:text-2xl">
              <XCircle className="mr-4 h-6 w-6 lg:h-10 lg:w-10" />
              Try again.
            </div>
          )}

          {!feedback && !intermission && !complete && exercise === 3 && (
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "lg"}
              disabled={!!feedback || !!motion}
              onClick={skipListening}
              className="font-bold uppercase tracking-wider text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 active:bg-neutral-200"
            >
              Can&apos;t listen now
            </Button>
          )}

          {!feedback && !intermission && !complete && exercise !== 3 && (
            <div className="hidden text-sm font-semibold text-muted-foreground sm:block">
              {english || arabic
                ? "Now select its translation."
                : "Select a word in either column."}
            </div>
          )}

          {intermission && (
            <Button
              size={isMobile ? "sm" : "lg"}
              onClick={continueExercise}
              className="ml-auto"
              variant="secondary"
            >
              Continue
            </Button>
          )}

          {complete && (
            <>
              <Button
                variant="default"
                size={isMobile ? "sm" : "lg"}
                onClick={reset}
              >
                Practice again
              </Button>
              <Button
                size={isMobile ? "sm" : "lg"}
                onClick={() => router.push("/practice/words")}
                className="ml-auto"
                variant="secondary"
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
