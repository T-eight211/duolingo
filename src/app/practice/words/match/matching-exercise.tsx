"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, InfinityIcon, Volume2, X } from "lucide-react";
import { useKey, useMedia, useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeWordPracticeAction } from "@/actions/vocabulary";
import { useExitModal } from "@/store/use-exit-modal";
import styles from "./matching-exercise.module.css";
import { cn } from "@/lib/utils";
import {
  type WordPair,
  type ExerciseType,
  type ExerciseSlotKind,
  type ExerciseStagePlan,
  type SessionPlan,
  shuffle,
  createSessionPlan,
} from "./session-plan";

export type {
  WordPair,
  ExerciseType,
  ExerciseSlotKind,
  ExerciseStagePlan,
  SessionPlan,
};

const waveform = [5, 12, 22, 30, 25, 38, 29, 21, 13, 20, 12, 8, 5];

export function MatchingExercise({
  initialSessionPlan,
  words,
  hearts = 5,
  isPro = false,
}: {
  initialSessionPlan?: SessionPlan;
  words: WordPair[];
  hearts?: number;
  isPro?: boolean;
}) {
  const router = useRouter();
  const { open: openExitModal } = useExitModal();
  const isMobile = useMedia("(max-width: 1024px)");
  const { width, height } = useWindowSize();

  const [sessionPlan, setSessionPlan] = useState<SessionPlan>(
    () => initialSessionPlan ?? createSessionPlan(words),
  );
  const [stageIndex, setStageIndex] = useState(0);

  const currentStage =
    sessionPlan.stages[stageIndex] ?? sessionPlan.stages[0];

  const [leftSlots, setLeftSlots] = useState<WordPair[]>(
    () => currentStage.initialLeftSlots ?? shuffle(currentStage.initialPairs),
  );
  const [rightSlots, setRightSlots] = useState<WordPair[]>(
    () => currentStage.initialRightSlots ?? shuffle(currentStage.initialPairs),
  );

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [finishedMatches, setFinishedMatches] = useState(0);

  const [feedback, setFeedback] = useState<{
    leftId: string;
    rightId: string;
    correct: boolean;
  } | null>(null);
  const [motion, setMotion] = useState<{
    phase: "leaving" | "entering";
    ids: string[];
  } | null>(null);

  const [intermission, setIntermission] = useState(false);
  const [listeningSkipped, setListeningSkipped] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // If user skipped listening, subsequent listening exercises gracefully adapt to text
  const effectiveIsListening = currentStage.isListening && !listeningSkipped;
  const effectiveLeftKind =
    currentStage.isListening && listeningSkipped
      ? "arabic"
      : currentStage.leftKind;

  const totalPairs = currentStage.totalCount;
  const isStageComplete = matched.length === totalPairs && !feedback;
  const complete = stageIndex === 2 && isStageComplete;
  const sessionMatched = finishedMatches + matched.length;

  // Completed exercise milestones count (0, 1, 2, or 3)
  const completedExercisesCount = stageIndex + (intermission || complete ? 1 : 0);

  const currentFraction = totalPairs > 0 ? matched.length / totalPairs : 0;
  const overallPercentage = Math.min(
    100,
    complete
      ? 100
      : Math.round(((stageIndex + currentFraction) / 3) * 100),
  );

  useEffect(() => {
    if (motion?.phase !== "entering") return;
    const timer = window.setTimeout(() => setMotion(null), 650);
    return () => window.clearTimeout(timer);
  }, [motion]);

  useEffect(() => {
    if (complete && !awardedPoints) {
      setAwardedPoints(true);
      completeWordPracticeAction().then((res) => {
        if (res.success) {
          toast.success("Practice complete! +10 XP earned!");
        }
      });
    }
  }, [complete, awardedPoints]);

  // Prevent accidental loss of progress if user refreshes or closes tab mid-game
  useEffect(() => {
    if (complete || (matched.length === 0 && stageIndex === 0)) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [complete, matched.length, stageIndex]);

  function playWordAudio(pair: WordPair) {
    if (typeof window === "undefined" || !pair.audioSrc) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const audio = new Audio(pair.audioSrc);
    currentAudioRef.current = audio;
    audio.onended = () => {
      currentAudioRef.current = null;
    };
    audio.onerror = () => {
      currentAudioRef.current = null;
    };
    audio.play().catch(() => {
      currentAudioRef.current = null;
    });
  }

  function handleSelect(side: "left" | "right", pair: WordPair) {
    if (feedback || motion || intermission || matched.includes(pair.id)) return;

    const kind = side === "left" ? effectiveLeftKind : currentStage.rightKind;
    if (
      currentStage.hasAudio !== false &&
      (kind === "audio" || (kind === "arabic" && !currentStage.isListening))
    ) {
      playWordAudio(pair);
    }

    const nextLeft =
      side === "left" ? (selectedLeft === pair.id ? null : pair.id) : selectedLeft;
    const nextRight =
      side === "right"
        ? (selectedRight === pair.id ? null : pair.id)
        : selectedRight;

    setSelectedLeft(nextLeft);
    setSelectedRight(nextRight);

    if (nextLeft && nextRight) {
      const isCorrect = nextLeft === nextRight;

      if (!isCorrect) {
        setFeedback({ leftId: nextLeft, rightId: nextRight, correct: false });
        window.setTimeout(() => {
          setFeedback(null);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 700);
        return;
      }

      // Correct match
      setFeedback({ leftId: nextLeft, rightId: nextRight, correct: true });

      const nextMatched = [...matched, nextLeft];
      setMatched(nextMatched);

      const isAdvance = stageIndex < 2 && nextMatched.length === totalPairs;
      // Immediately pull in the next refill word on every single match
      const refillIndex = matched.length;
      const replacement =
        currentStage.hasRefill && refillIndex < currentStage.extraPairs.length
          ? currentStage.extraPairs[refillIndex]
          : undefined;

      const animate = isAdvance || !!replacement;

      if (animate) {
        window.setTimeout(() => {
          setMotion({
            phase: "leaving",
            ids: isAdvance
              ? [...currentStage.initialPairs, ...currentStage.extraPairs].map(
                  (p) => p.id,
                )
              : [nextLeft],
          });
        }, 350);
      }

      window.setTimeout(
        () => {
          if (isAdvance) {
            setIntermission(true);
            setMotion(null);
          } else if (replacement) {
            setLeftSlots((slots) =>
              slots.map((p) => (p.id === nextLeft ? replacement : p)),
            );
            setRightSlots((slots) =>
              slots.map((p) => (p.id === nextRight ? replacement : p)),
            );
            setMotion({ phase: "entering", ids: [replacement.id] });
          }
          setFeedback(null);
          setSelectedLeft(null);
          setSelectedRight(null);
        },
        animate ? 850 : 650,
      );
    }
  }

  function continueExercise() {
    if (stageIndex >= 2) return;
    const nextIndex = stageIndex + 1;
    const nextStage = sessionPlan.stages[nextIndex];

    setFinishedMatches((count) => count + matched.length);
    setStageIndex(nextIndex);
    setLeftSlots(nextStage.initialLeftSlots ?? shuffle(nextStage.initialPairs));
    setRightSlots(nextStage.initialRightSlots ?? shuffle(nextStage.initialPairs));
    setMatched([]);
    setFeedback(null);
    setSelectedLeft(null);
    setSelectedRight(null);
    setIntermission(false);
    setMotion({
      phase: "entering",
      ids: nextStage.initialPairs.map((p) => p.id),
    });
  }

  function skipListening() {
    setListeningSkipped(true);
    if (stageIndex < 2) {
      continueExercise();
    } else {
      setMatched(currentStage.initialPairs.map((p) => p.id));
    }
  }

  function reset() {
    const newPlan = createSessionPlan(words);
    setSessionPlan(newPlan);
    setStageIndex(0);
    const firstStage = newPlan.stages[0];
    setLeftSlots(firstStage.initialLeftSlots ?? shuffle(firstStage.initialPairs));
    setRightSlots(firstStage.initialRightSlots ?? shuffle(firstStage.initialPairs));
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatched([]);
    setFeedback(null);
    setMotion(null);
    setIntermission(false);
    setListeningSkipped(false);
    setFinishedMatches(0);
    setAwardedPoints(false);
  }

  useKey("Enter", () => {
    if (intermission) {
      continueExercise();
    } else if (complete) {
      router.push("/practice/words");
    }
  });

  function renderTile(pair: WordPair, side: "left" | "right", index: number) {
    const kind = side === "left" ? effectiveLeftKind : currentStage.rightKind;
    const isAudio = kind === "audio";
    const isMatched = matched.includes(pair.id);
    const isSelected =
      (side === "left" ? selectedLeft : selectedRight) === pair.id;
    const isFeedback =
      feedback &&
      (side === "left"
        ? feedback.leftId === pair.id
        : feedback.rightId === pair.id);
    const result = isFeedback ? feedback : null;

    // When matched or correctly answered, reveal the Arabic word instead of sound wave
    const isMatchedOrCorrect = isMatched || (result?.correct ?? false);
    const showWave = isAudio && !isMatchedOrCorrect;
    const isArabic = kind === "arabic" || (isAudio && isMatchedOrCorrect);

    return (
      <button
        key={pair.id}
        type="button"
        onClick={() => handleSelect(side, pair)}
        disabled={isMatched || !!feedback || !!motion}
        aria-pressed={isSelected}
        aria-label={
          showWave
            ? `Play audio ${index + 1}`
            : `${isArabic ? pair.arabic : pair.english}${isMatched ? ", matched" : ""}`
        }
        lang={isArabic && !showWave ? "ar" : "en"}
        dir={isArabic && !showWave ? "rtl" : "ltr"}
        className={cn(
          styles.tile,
          motion?.ids.includes(pair.id) &&
            (motion.phase === "leaving" ? styles.leaving : styles.entering),
          "relative flex h-[72px] w-full items-center justify-center rounded-2xl border-2 border-b-4 bg-white px-3 text-lg font-bold text-neutral-700 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:h-[84px] sm:text-xl",
          isArabic && !showWave && "text-2xl sm:text-3xl font-bold font-arabic",
          !isMatched && !feedback && "hover:bg-slate-50 active:border-b-2",
          showWave && "text-sky-500",
          isSelected && "border-sky-400 bg-sky-50 text-sky-600",
          isMatched &&
            !result &&
            "border-slate-200 bg-slate-50 text-slate-300",
          result?.correct && "border-green-500 bg-green-50 text-green-600",
          result &&
            !result.correct &&
            "border-rose-400 bg-rose-50 text-rose-500",
        )}
      >
        {showWave ? (
          <>
            <span
              className="flex h-10 w-full max-w-[130px] sm:max-w-[140px] items-center justify-between gap-0.5"
              aria-hidden="true"
            >
              {waveform.map((h, bar) => (
                <span
                  key={bar}
                  className="w-1 rounded-full bg-current sm:w-1.5"
                  style={{ height: h }}
                />
              ))}
            </span>
            <Volume2
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 h-6 w-6 shrink-0 [transform:scaleX(-1)]"
              aria-hidden="true"
            />
          </>
        ) : isArabic ? (
          pair.arabic
        ) : (
          pair.english
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

      {/* Top Header - Lesson Stepper and Hearts */}
      <header className="mx-auto flex w-full max-w-[1140px] items-center justify-between gap-x-7 px-10 pt-[20px] lg:pt-[50px]">
        <button
          type="button"
          onClick={() => openExitModal("/practice/words")}
          className="cursor-pointer text-slate-500 transition hover:opacity-75 focus-visible:outline-hidden"
          aria-label="Exit word practice"
        >
          <X className="h-6 w-6 stroke-[2.5]" />
        </button>

        {/* Stepper Progress Bar */}
        <div className="relative flex flex-1 items-center">
          <div className="relative h-4 sm:h-5 w-full rounded-full bg-slate-200 dark:bg-[#37464f] flex items-center">
            {/* Unreached Speed Bump 1 (33.33%) - same color as bar so only the bump edges outside the bar are seen */}
            {completedExercisesCount < 1 && (
              <div
                className="absolute left-[33.33%] -translate-x-1/2 size-6 sm:size-7 rounded-full bg-slate-200 dark:bg-[#37464f] pointer-events-none"
                title="Exercise 1"
              />
            )}

            {/* Unreached Speed Bump 2 (66.67%) - same color as bar so only the bump edges outside the bar are seen */}
            {completedExercisesCount < 2 && (
              <div
                className="absolute left-[66.67%] -translate-x-1/2 size-6 sm:size-7 rounded-full bg-slate-200 dark:bg-[#37464f] pointer-events-none"
                title="Exercise 2"
              />
            )}

            {/* Unreached Final Goal '5' (right end) - same color bulb as bar */}
            {!complete && (
              <div
                className="absolute right-0 translate-x-1/4 size-7 sm:size-8 rounded-full bg-slate-200 dark:bg-[#37464f] flex items-center justify-center text-xs font-black text-slate-500 dark:text-slate-400 pointer-events-none"
                title="Final goal: 5"
              >
                5
              </div>
            )}

            {/* Green progress fill */}
            <div
              className="relative h-full rounded-full bg-[#58cc02] transition-all duration-500 ease-out flex items-center justify-end z-10"
              style={{
                width: `${Math.max(
                  overallPercentage > 0 ? 5 : 0,
                  Math.min(100, overallPercentage),
                )}%`,
              }}
            >
              {/* Glossy highlight inside progress */}
              <div className="absolute top-1 left-2 right-2 h-1 rounded-full bg-white/30 pointer-events-none" />
            </div>

            {/* Completed Node 1 (33.33%) */}
            {completedExercisesCount >= 1 && (
              <div
                className="absolute left-[33.33%] -translate-x-1/2 size-7 sm:size-8 rounded-full bg-[#58cc02] flex items-center justify-center text-white z-20 shadow-xs"
                title="Exercise 1 completed"
              >
                <Check className="size-4 sm:size-4.5 stroke-[4]" />
              </div>
            )}

            {/* Completed Node 2 (66.67%) */}
            {completedExercisesCount >= 2 && (
              <div
                className="absolute left-[66.67%] -translate-x-1/2 size-7 sm:size-8 rounded-full bg-[#58cc02] flex items-center justify-center text-white z-20 shadow-xs"
                title="Exercise 2 completed"
              >
                <Check className="size-4 sm:size-4.5 stroke-[4]" />
              </div>
            )}

            {/* Final Target / Completed Finish Node at 100% */}
            {complete && (
              <div
                className="absolute right-0 translate-x-1/4 size-7 sm:size-8 rounded-full bg-[#58cc02] flex items-center justify-center text-white z-20 shadow-xs"
                title="Practice completed"
              >
                <Check className="size-4 sm:size-4.5 stroke-[4]" />
              </div>
            )}
          </div>
        </div>

        {/* Hearts counter */}
        <div className="flex items-center font-bold text-rose-500">
          <Image
            src="/heart.svg"
            alt="hearts"
            height={28}
            width={28}
            className="mr-2 shrink-0"
          />
          {isPro ? (
            <InfinityIcon className="h-6 w-6 shrink-0 stroke-3" />
          ) : (
            hearts
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex flex-1 flex-col items-center justify-center py-6">
        {intermission ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="flex max-w-[500px] items-center justify-center gap-4 sm:gap-8">
              <div className="relative rounded-2xl border-2 bg-white p-5 shadow-sm sm:p-7">
                <h1 className="text-xl font-bold leading-relaxed text-neutral-700 sm:text-2xl">
                  {stageIndex === 0
                    ? "Great job! Let’s keep the momentum going."
                    : "Almost done! Let’s make it a bit harder…"}
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
              {currentStage.title}
            </h1>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4" dir="ltr">
              <div
                className="flex flex-col gap-3 sm:gap-4"
                role="group"
                aria-label="Left matching column"
              >
                {leftSlots.map((pair, index) =>
                  renderTile(pair, "left", index),
                )}
              </div>
              <div
                className="flex flex-col gap-3 sm:gap-4"
                role="group"
                aria-label="Right matching column"
              >
                {rightSlots.map((pair, index) =>
                  renderTile(pair, "right", index),
                )}
              </div>
            </div>

            {/* Can't listen now - shown during active listening exercises */}
            {effectiveIsListening && (
              <div className="mt-8 flex justify-center pb-2">
                <button
                  type="button"
                  onClick={skipListening}
                  className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-600 active:text-slate-800 transition focus-visible:outline-hidden"
                >
                  Can&apos;t listen now
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Footer */}
      {(intermission || complete) && (
        <footer className="h-[100px] border-t-2 bg-white lg:h-[130px] transition-all duration-300">
          <div className="mx-auto flex h-full max-w-[1140px] items-center justify-between px-6 lg:px-10">
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
      )}
    </div>
  );
}
