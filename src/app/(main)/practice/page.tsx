import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Repeat2, Volume2 } from "lucide-react";

import { FeedWrapper } from "@/components/feed-wrapper";
import { Header } from "@/app/(main)/learn/_components/header";
import { Promo } from "@/components/promo";
import { Quests } from "@/components/quests";
import { StickyWrapper } from "@/components/sticky-wrapper";
import { Button } from "@/components/ui/button";
import { UserProgress } from "@/components/user-progress";
import { getUserProgress, getUserSubscription } from "@/db/queries";
import { arabicCourse } from "@/lib/arabic-course";

export const metadata: Metadata = {
  title: "Lingo | Practice",
  description:
    "Build your skills with listening practice, mistakes, and words.",
};

const activities = [
  {
    title: "Listen",
    description: "Build confidence with listening practice.",
    icon: Volume2,
    color: "bg-sky-100 text-sky-500",
  },
  {
    title: "Mistakes",
    description: "Review tricky questions and learn from your mistakes.",
    icon: Repeat2,
    color: "bg-orange-100 text-orange-500",
  },
  {
    title: "Words",
    description: "Keep the words you've learned fresh in your mind.",
    icon: BookOpen,
    color: "bg-indigo-100 text-indigo-500",
  },
];

function ActivityCard({
  title,
  description,
  icon: Icon,
  color,
  wordsEnabled = false,
}: (typeof activities)[number] & { wordsEnabled?: boolean }) {
  const isWords = title === "Words";
  const className =
    "flex w-full items-center gap-4 rounded-xl border-2 border-b-4 p-4 text-left transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:border-b-2";
  const content = (
    <>
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${color}`}
      >
        <Icon className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-xl font-bold text-neutral-700">
          {title}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
    </>
  );
  return isWords && wordsEnabled ? (
    <Link href="/practice/words" className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className}>
      {content}
    </button>
  );
}

export default async function PracticePage() {
  const [userProgress, userSubscription] = await Promise.all([
    getUserProgress(),
    getUserSubscription(),
  ]);

  if (!userProgress || !userProgress.activeCourse) {
    redirect("/courses");
  }

  const isPro = !!userSubscription?.isActive;
  const wordsEnabled = userProgress.activeCourse.title === arabicCourse.title;

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
        <Header title="Practice" href="/learn" />
        <header className="flex w-full flex-col items-center">
          <Image src="/practice.svg" alt="" height={90} width={90} />
          <h1 className="my-6 text-center text-2xl font-bold text-neutral-800">
            Practice
          </h1>
          <p className="mb-6 text-center text-lg text-muted-foreground">
            A little practice, a lot of progress.
          </p>
        </header>

        <section
          className="rounded-xl border-2 border-b-4 border-sky-200 bg-sky-50 p-5"
          aria-labelledby="target-title"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2
                id="target-title"
                className="text-xl font-bold text-neutral-800"
              >
                Target Practice
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tackle weak areas with this customized session.
              </p>
            </div>
            <Image
              src="/mascot.svg"
              alt=""
              width={80}
              height={80}
              className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="mt-5 w-full"
          >
            Start +20 XP
          </Button>
        </section>

        <section className="mt-8" aria-labelledby="conversation-title">
          <h2
            id="conversation-title"
            className="mb-4 text-xl font-bold text-neutral-800"
          >
            Conversation
          </h2>
          <ActivityCard {...activities[0]} />
        </section>

        <section className="mt-8" aria-labelledby="collections-title">
          <h2
            id="collections-title"
            className="mb-4 text-xl font-bold text-neutral-800"
          >
            Your collections
          </h2>
          <div className="space-y-3">
            {activities.slice(1).map((activity) => (
              <ActivityCard
                key={activity.title}
                {...activity}
                wordsEnabled={wordsEnabled}
              />
            ))}
          </div>
        </section>
      </FeedWrapper>
    </div>
  );
}
