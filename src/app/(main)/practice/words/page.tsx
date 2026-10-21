import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { FeedWrapper } from "@/components/feed-wrapper";
import { Header } from "@/app/(main)/learn/_components/header";
import { Promo } from "@/components/promo";
import { Quests } from "@/components/quests";
import { StickyWrapper } from "@/components/sticky-wrapper";
import { UserProgress } from "@/components/user-progress";
import { getUserProgress, getUserSubscription } from "@/db/queries";
import { WordList } from "./word-list";
import { arabicCourse } from "@/lib/arabic-course";
import { getVocabulary } from "@/db/vocabulary";
import { VocabularyUpload } from "./vocabulary-upload";
import { StartPracticeButton } from "./start-practice-button";

export const metadata: Metadata = {
  title: "Lingo | Words",
  description: "Review and practice your vocabulary.",
};

export default async function WordsPage() {
  const [userProgress, userSubscription, vocabulary] = await Promise.all([
    getUserProgress(),
    getUserSubscription(),
    getVocabulary(),
  ]);
  if (!userProgress || !userProgress.activeCourse) redirect("/courses");
  if (userProgress.activeCourse.title !== arabicCourse.title)
    redirect("/practice");
  const isPro = !!userSubscription?.isActive;
  const userWords = vocabulary.filter((entry) => entry.kind === "word");

  return (
    <div className="flex flex-row-reverse gap-[48px] px-6">
      <StickyWrapper>
        <UserProgress
          activeCourse={userProgress.activeCourse}
          hearts={userProgress.hearts}
          points={userProgress.points}
          hasActiveSubscription={isPro}
        />
        {!isPro && <Promo />}
        <Quests points={userProgress.points} />
      </StickyWrapper>
      <FeedWrapper>
        <Header title="Practice" href="/practice" />
        <header>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl leading-snug font-bold text-neutral-800">
                Practice your
                <br />
                Arabic words
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Beginner Modern Standard Arabic vocabulary
              </p>
            </div>
            <div
              className="relative mr-2 h-24 w-20 shrink-0"
              aria-hidden="true"
            >
              <div className="absolute top-3 left-4 h-20 w-14 rotate-20 rounded-xl border-2 border-indigo-200 bg-indigo-100" />
              <div className="absolute top-0 left-0 flex h-20 w-14 -rotate-6 items-center justify-center rounded-xl border-2 border-b-4 border-sky-300 bg-sky-100 text-sky-500">
                <Sparkles className="h-8 w-8" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <StartPracticeButton wordCount={userWords.length} />
            <div className="w-full sm:flex-1">
              <VocabularyUpload existingEntries={vocabulary} />
            </div>
          </div>
        </header>
        <WordList entries={vocabulary} />
      </FeedWrapper>
    </div>
  );
}
