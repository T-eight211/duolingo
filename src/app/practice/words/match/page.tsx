import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserProgress, getUserSubscription } from "@/db/queries";
import { arabicCourse } from "@/lib/arabic-course";
import { getVocabulary } from "@/db/vocabulary";
import { MatchingExercise } from "./matching-exercise";
import { createSessionPlan, type WordPair } from "./session-plan";

export const metadata: Metadata = {
  title: "Lingo | Match the words",
  description: "Match Arabic words with their English translations.",
};

export default async function MatchingPage() {
  const [userProgress, userSubscription, vocabulary] = await Promise.all([
    getUserProgress(),
    getUserSubscription(),
    getVocabulary(),
  ]);
  if (!userProgress?.activeCourse) redirect("/courses");
  if (userProgress.activeCourse.title !== arabicCourse.title)
    redirect("/practice");

  const userWords = vocabulary.filter((entry) => entry.kind === "word");

  // In order to play the practice word game, they must add at least 40 words
  if (userWords.length < 40) {
    redirect("/practice/words");
  }

  const pairs: WordPair[] = userWords.map((w) => ({
    id: w.id,
    english: w.english,
    arabic: w.arabicDiacritized || w.arabic,
    audioSrc: w.audioSrc ?? null,
    errorCount: w.errorCount ?? 0,
    correctCount: w.correctCount ?? 0,
  }));

  const initialSessionPlan = createSessionPlan(pairs);

  return (
    <MatchingExercise
      initialSessionPlan={initialSessionPlan}
      words={pairs}
      hearts={userProgress.hearts}
      isPro={!!userSubscription?.isActive}
    />
  );
}
