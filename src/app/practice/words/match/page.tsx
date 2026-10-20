import type { Metadata } from "next";
import { MatchingExercise } from "./matching-exercise";
import { redirect } from "next/navigation";
import { getUserProgress } from "@/db/queries";
import { arabicCourse } from "@/lib/arabic-course";

export const metadata: Metadata = {
  title: "Lingo | Match the words",
  description: "Match Arabic words with their English translations.",
};

export default async function MatchingPage() {
  const userProgress = await getUserProgress();
  if (!userProgress?.activeCourse) redirect("/courses");
  if (userProgress.activeCourse.title !== arabicCourse.title)
    redirect("/practice");
  return <MatchingExercise />;
}
