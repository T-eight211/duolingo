import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { arabicCourse } from "@/lib/arabic-course";
import type { ArabicGrammar } from "@/lib/grammar/types";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";
import db from "./drizzle";
import {
  courses,
  userProgress,
  userVocabulary,
  userVocabularyLinks,
} from "./schema";
import { prepareVocabularySave } from "./vocabulary-plan";

export class VocabularyCourseError extends Error {
  constructor() {
    super("Select the Arabic course before adding vocabulary.");
  }
}

/** Called only by the validated action with a user ID obtained from Clerk. */
export async function saveUserVocabulary(
  userId: string,
  entries: VocabularyEntry[],
  database: Pick<typeof db, "transaction"> = db,
) {
  const plan = prepareVocabularySave(entries);

  return database.transaction(async (tx) => {
    // Hold the active course until commit so a simultaneous course switch cannot
    // move these words into a different language while the save is in flight.
    const [course] = await tx
      .select({ id: courses.id, title: courses.title })
      .from(userProgress)
      .innerJoin(courses, eq(courses.id, userProgress.activeCourseId))
      .where(eq(userProgress.userId, userId))
      .limit(1)
      .for("update", { of: userProgress });

    if (!course || course.title !== arabicCourse.title) {
      throw new VocabularyCourseError();
    }

    const inserted = await tx
      .insert(userVocabulary)
      .values(
        plan.entries.map((entry) => ({
          userId,
          courseId: course.id,
          kind: entry.kind,
          partOfSpeech: entry.partOfSpeech ?? entry.grammar?.part_of_speech ?? null,
          grammar: entry.grammar ?? null,
          arabic: entry.arabic,
          arabicDiacritized: entry.arabicDiacritized,
          english: entry.english,
          originalArabic: entry.originalArabic,
          originalEnglish: entry.originalEnglish,
          corrections: entry.corrections,
          needsReview: entry.needsReview,
          reviewReason: entry.reviewReason,
          normalizedKey: entry.normalizedKey,
        })),
      )
      .onConflictDoUpdate({
        target: [
          userVocabulary.userId,
          userVocabulary.courseId,
          userVocabulary.kind,
          userVocabulary.normalizedKey,
        ],
        set: {
          partOfSpeech: sql`COALESCE(excluded.part_of_speech, user_vocabulary.part_of_speech)`,
          grammar: sql`COALESCE(excluded.grammar, user_vocabulary.grammar)`,
        },
      })
      .returning({ id: userVocabulary.id });

    // Re-read both new and existing IDs in the transaction. Retrying a save or
    // importing the same word in another sentence preserves its database ID.
    const saved = await tx
      .select({ id: userVocabulary.id, key: userVocabulary.normalizedKey })
      .from(userVocabulary)
      .where(
        and(
          eq(userVocabulary.userId, userId),
          eq(userVocabulary.courseId, course.id),
          inArray(
            userVocabulary.normalizedKey,
            plan.entries.map((entry) => entry.normalizedKey),
          ),
        ),
      );

    const savedIds = new Map(saved.map((entry) => [entry.key, entry.id]));
    const links = plan.links.map(({ sourceKey, wordKey }) => {
      const sourceId = savedIds.get(sourceKey);
      const wordId = savedIds.get(wordKey);
      if (!sourceId || !wordId) {
        throw new Error("Could not resolve vocabulary relationships.");
      }
      return { userId, courseId: course.id, sourceId, wordId };
    });

    if (links.length) {
      await tx.insert(userVocabularyLinks).values(links).onConflictDoNothing();
    }

    return {
      added: inserted.length,
      duplicates: entries.length - inserted.length,
    };
  });
}

export async function updateWordGrammar(
  userId: string,
  wordId: string,
  grammar: ArabicGrammar,
) {
  const [updated] = await db
    .update(userVocabulary)
    .set({
      partOfSpeech: grammar.part_of_speech,
      grammar,
    })
    .where(
      and(
        eq(userVocabulary.id, wordId),
        eq(userVocabulary.userId, userId),
      ),
    )
    .returning();
  return updated;
}

