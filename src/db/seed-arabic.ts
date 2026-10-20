import { and, eq, sql } from "drizzle-orm";
import db from "./drizzle";
import {
  courses,
  units,
  lessons,
  challenges,
  challengeOptions,
} from "./schema";
import { arabicCourse } from "../lib/arabic-course";

/** Add missing Arabic content while preserving existing courses and progress. */
export async function seedArabicCourse() {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(
      sql`LOCK TABLE courses, units, lessons, challenges, challenge_options IN SHARE ROW EXCLUSIVE MODE`,
    );

    // Older seeds used explicit IDs without advancing the serial sequences.
    for (const table of [
      "courses",
      "units",
      "lessons",
      "challenges",
      "challenge_options",
    ]) {
      await tx.execute(sql`
        SELECT setval(pg_get_serial_sequence(${table}, 'id'),
          greatest(
            coalesce((SELECT max(id) FROM ${sql.identifier(table)}), 0) + 1,
            nextval(pg_get_serial_sequence(${table}, 'id'))
          ), false)
      `);
    }

    let course = await tx.query.courses.findFirst({
      where: eq(courses.title, arabicCourse.title),
    });
    if (!course) {
      [course] = await tx
        .insert(courses)
        .values({ title: arabicCourse.title, imageSrc: arabicCourse.imageSrc })
        .returning();
    }
    let unit = await tx.query.units.findFirst({
      where: and(
        eq(units.courseId, course.id),
        eq(units.title, arabicCourse.unitTitle),
      ),
    });
    if (!unit) {
      [unit] = await tx
        .insert(units)
        .values({
          courseId: course.id,
          title: arabicCourse.unitTitle,
          description: arabicCourse.description,
          order: 1,
        })
        .returning();
    }

    for (const [lessonIndex, content] of arabicCourse.lessons.entries()) {
      let lesson = await tx.query.lessons.findFirst({
        where: and(
          eq(lessons.unitId, unit.id),
          eq(lessons.title, content.title),
        ),
      });
      if (!lesson) {
        [lesson] = await tx
          .insert(lessons)
          .values({
            unitId: unit.id,
            title: content.title,
            order: lessonIndex + 1,
          })
          .returning();
      }
      for (const [wordIndex, word] of content.words.entries()) {
        const question = `Which word means “${word.translation}”?`;
        const existing = await tx.query.challenges.findFirst({
          where: and(
            eq(challenges.lessonId, lesson.id),
            eq(challenges.question, question),
          ),
        });
        if (existing) continue;
        const [challenge] = await tx
          .insert(challenges)
          .values({
            lessonId: lesson.id,
            type: "SELECT",
            question,
            order: wordIndex + 1,
          })
          .returning();
        await tx.insert(challengeOptions).values(
          content.words.map((option) => ({
            challengeId: challenge.id,
            text: option.word,
            correct: option.word === word.word,
          })),
        );
      }
    }
    return course;
  });
}
