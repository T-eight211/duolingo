import "server-only";

import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";

import { arabicCourse } from "@/lib/arabic-course";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";
import db from "./drizzle";
import {
  courses,
  userProgress,
  userVocabulary,
  userVocabularyLinks,
} from "./schema";

export const getVocabulary = cache(async (): Promise<VocabularyEntry[]> => {
  const { userId } = await auth();
  if (!userId) return [];

  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(userProgress)
    .innerJoin(courses, eq(courses.id, userProgress.activeCourseId))
    .where(eq(userProgress.userId, userId))
    .limit(1);

  if (!course || course.title !== arabicCourse.title) return [];

  const [entries, links] = await Promise.all([
    db
      .select()
      .from(userVocabulary)
      .where(
        and(
          eq(userVocabulary.userId, userId),
          eq(userVocabulary.courseId, course.id),
        ),
      )
      .orderBy(desc(userVocabulary.createdAt), userVocabulary.id),
    db
      .select({
        wordId: userVocabularyLinks.wordId,
        sourceId: userVocabularyLinks.sourceId,
      })
      .from(userVocabularyLinks)
      .where(
        and(
          eq(userVocabularyLinks.userId, userId),
          eq(userVocabularyLinks.courseId, course.id),
        ),
      ),
  ]);

  const sourceIds = new Map<string, string[]>();
  for (const link of links) {
    const sources = sourceIds.get(link.wordId) ?? [];
    sources.push(link.sourceId);
    sourceIds.set(link.wordId, sources);
  }

  return entries.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    arabic: entry.arabic,
    arabicDiacritized: entry.arabicDiacritized,
    english: entry.english,
    originalArabic: entry.originalArabic,
    originalEnglish: entry.originalEnglish,
    corrections: entry.corrections,
    needsReview: entry.needsReview,
    reviewReason: entry.reviewReason,
    partOfSpeech: entry.partOfSpeech,
    grammar: entry.grammar,
    audioSrc: entry.audioSrc,
    category: entry.category,
    sourceIds: sourceIds.get(entry.id) ?? [],
  }));
});
