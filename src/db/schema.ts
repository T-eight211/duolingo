import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";
import type { ArabicGrammar, PartOfSpeech } from "@/lib/grammar/types";

export const admin = pgTable("admin", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageSrc: text("image_src").notNull(),
});

export const coursesRelations = relations(courses, ({ many }) => ({
  userProgress: many(userProgress),
  units: many(units),
}));

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // Unit 1
  description: text("description").notNull(), // Learn the basics of spanish
  courseId: integer("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  order: integer("order").notNull(),
});

export const unitsRelations = relations(units, ({ many, one }) => ({
  course: one(courses, {
    fields: [units.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  unitId: integer("unit_id")
    .references(() => units.id, { onDelete: "cascade" })
    .notNull(),
  order: integer("order").notNull(),
});

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  unit: one(units, {
    fields: [lessons.unitId],
    references: [units.id],
  }),
  challenges: many(challenges),
}));

export const challengesEnum = pgEnum("type", ["SELECT", "ASSIST"]);

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  type: challengesEnum("type").notNull(),
  question: text("question").notNull(),
  order: integer("order").notNull(),
});

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [challenges.lessonId],
    references: [lessons.id],
  }),
  challengeOptions: many(challengeOptions),
  challengeProgress: many(challengeProgress),
}));

export const challengeOptions = pgTable("challenge_options", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  text: text("text").notNull(),
  correct: boolean("correct").notNull(),
  imageSrc: text("image_src"),
  audioSrc: text("audio_src"),
});

export const challengeOptionsRelations = relations(
  challengeOptions,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengeOptions.challengeId],
      references: [challenges.id],
    }),
  }),
);

export const challengeProgress = pgTable("challenge_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  challengeId: integer("challenge_id")
    .references(() => challenges.id, { onDelete: "cascade" })
    .notNull(),
  completed: boolean("completed").notNull().default(false),
});

export const challengeProgressRelations = relations(
  challengeProgress,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengeProgress.challengeId],
      references: [challenges.id],
    }),
  }),
);

export const userProgress = pgTable("user_progress", {
  userId: text("user_id").primaryKey(),
  userName: text("user_name").notNull().default("User"),
  userImageSrc: text("user_image_src").notNull().default("/mascot.svg"),
  activeCourseId: integer("active_course_id").references(() => courses.id, {
    onDelete: "cascade",
  }),
  hearts: integer("hearts").notNull().default(5),
  points: integer("points").notNull().default(0),
});

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  activeCourse: one(courses, {
    fields: [userProgress.activeCourseId],
    references: [courses.id],
  }),
}));

export const userSubscription = pgTable("user_subscription", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end").notNull(),
});

// Clerk authenticates these records through the server. RLS has no public
// policies, and the additive migration revokes Supabase Data API grants.
export const userVocabulary = pgTable(
  "user_vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => userProgress.userId, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    kind: text("kind").$type<VocabularyEntry["kind"]>().notNull(),
    arabic: text("arabic").notNull(),
    arabicDiacritized: text("arabic_diacritized").notNull(),
    english: text("english").notNull(),
    originalArabic: text("original_arabic"),
    originalEnglish: text("original_english"),
    corrections: jsonb("corrections")
      .$type<VocabularyEntry["corrections"]>()
      .notNull()
      .default([]),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewReason: text("review_reason"),
    partOfSpeech: text("part_of_speech").$type<PartOfSpeech>(),
    grammar: jsonb("grammar").$type<ArabicGrammar | null>(),
    audioSrc: text("audio_src"),
    category: text("category"),
    // SHA-256 of the normalized bilingual pair keeps sentence indexes bounded.
    normalizedKey: text("normalized_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("user_vocabulary_pair_unique").on(
      table.userId,
      table.courseId,
      table.kind,
      table.normalizedKey,
    ),
    unique("user_vocabulary_owner_id_unique").on(
      table.id,
      table.userId,
      table.courseId,
    ),
    index("user_vocabulary_course_idx").on(table.courseId),
    index("user_vocabulary_pos_idx").on(table.courseId, table.partOfSpeech),
    index("user_vocabulary_category_idx").on(table.courseId, table.category),
    check(
      "user_vocabulary_kind_check",
      sql`${table.kind} IN ('word', 'phrase', 'sentence')`,
    ),
    check(
      "user_vocabulary_text_check",
      sql`length(trim(${table.arabic})) > 0 AND length(trim(${table.arabicDiacritized})) > 0 AND length(trim(${table.english})) > 0`,
    ),
  ],
).enableRLS();

export const userVocabularyLinks = pgTable(
  "user_vocabulary_links",
  {
    userId: text("user_id").notNull(),
    courseId: integer("course_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    wordId: uuid("word_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "user_vocabulary_links_pk",
      columns: [table.userId, table.courseId, table.sourceId, table.wordId],
    }),
    foreignKey({
      name: "user_vocabulary_links_source_fk",
      columns: [table.sourceId, table.userId, table.courseId],
      foreignColumns: [
        userVocabulary.id,
        userVocabulary.userId,
        userVocabulary.courseId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "user_vocabulary_links_word_fk",
      columns: [table.wordId, table.userId, table.courseId],
      foreignColumns: [
        userVocabulary.id,
        userVocabulary.userId,
        userVocabulary.courseId,
      ],
    }).onDelete("cascade"),
    index("user_vocabulary_links_word_idx").on(
      table.userId,
      table.courseId,
      table.wordId,
    ),
    check(
      "user_vocabulary_links_distinct_check",
      sql`${table.sourceId} <> ${table.wordId}`,
    ),
  ],
).enableRLS();
