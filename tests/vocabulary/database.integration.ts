import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, ne, sql } from "drizzle-orm";
import db, { client } from "../../src/db/drizzle";
import {
  courses,
  userProgress,
  userVocabulary,
  userVocabularyLinks,
} from "../../src/db/schema";
import {
  saveUserVocabulary,
  VocabularyCourseError,
} from "../../src/db/vocabulary-store";
import { word, sentence } from "./fixtures";

test("real database: idempotent saves, owner isolation, links, edits and rollback", async () => {
  const rollback = new Error("Intentional test rollback");
  try {
    await assert.rejects(
      db.transaction(async (tx) => {
        const [arabic] = await tx
          .select()
          .from(courses)
          .where(eq(courses.title, "Arabic"))
          .limit(1);
        const [other] = await tx
          .select()
          .from(courses)
          .where(ne(courses.title, "Arabic"))
          .limit(1);
        assert(
          arabic && other,
          "Seed Arabic and another course before running this integration check.",
        );
        const alice = `vocabulary-test-${randomUUID()}`;
        const bob = `vocabulary-test-${randomUUID()}`;
        await tx.insert(userProgress).values([
          { userId: alice, activeCourseId: arabic.id },
          { userId: bob, activeCourseId: arabic.id },
        ]);
        const input = [
          sentence(),
          word({
            sourceIds: ["sentence"],
            originalEnglish: "bok",
            corrections: ["english_spelling"],
          }),
        ];
        assert.deepEqual(await saveUserVocabulary(alice, input, tx), {
          added: 2,
          duplicates: 0,
        });
        assert.deepEqual(await saveUserVocabulary(alice, input, tx), {
          added: 0,
          duplicates: 2,
        });
        assert.deepEqual(await saveUserVocabulary(bob, input, tx), {
          added: 2,
          duplicates: 0,
        });
        const own = await tx
          .select()
          .from(userVocabulary)
          .where(eq(userVocabulary.userId, alice));
        assert.equal(own.length, 2);
        assert.equal(
          own.find((entry) => entry.kind === "word")?.originalEnglish,
          "bok",
        );
        const links = await tx
          .select()
          .from(userVocabularyLinks)
          .where(eq(userVocabularyLinks.userId, alice));
        assert.equal(links.length, 1);
        assert(
          own.some(
            (entry) =>
              entry.id === links[0].sourceId && entry.kind === "sentence",
          ),
        );
        assert(
          own.some(
            (entry) => entry.id === links[0].wordId && entry.kind === "word",
          ),
        );

        // A repeated word can be attached to a new sentence without being inserted again.
        assert.deepEqual(
          await saveUserVocabulary(
            alice,
            [sentence({ english: "Here is a book." }), input[1]],
            tx,
          ),
          { added: 1, duplicates: 1 },
        );
        assert.equal(
          (
            await tx
              .select()
              .from(userVocabularyLinks)
              .where(eq(userVocabularyLinks.userId, alice))
          ).length,
          2,
        );
        await saveUserVocabulary(
          alice,
          [word({ english: "my edited meaning", originalEnglish: "bok" })],
          tx,
        );
        assert.equal(
          (
            await tx
              .select()
              .from(userVocabulary)
              .where(
                and(
                  eq(userVocabulary.userId, alice),
                  eq(userVocabulary.english, "my edited meaning"),
                ),
              )
          )[0].originalEnglish,
          "bok",
        );

        const bobWord = (
          await tx
            .select()
            .from(userVocabulary)
            .where(
              and(
                eq(userVocabulary.userId, bob),
                eq(userVocabulary.kind, "word"),
              ),
            )
        )[0];
        await assert.rejects(
          tx.transaction((inner) =>
            inner
              .insert(userVocabularyLinks)
              .values({
                userId: alice,
                courseId: arabic.id,
                sourceId: links[0].sourceId,
                wordId: bobWord.id,
              }),
          ),
        );
        const before = (
          await tx
            .select()
            .from(userVocabulary)
            .where(eq(userVocabulary.userId, alice))
        ).length;
        await assert.rejects(
          saveUserVocabulary(
            alice,
            [
              word({ english: "would be inserted" }),
              word({ id: "invalid", arabic: "", arabicDiacritized: "" }),
            ],
            tx,
          ),
        );
        assert.equal(
          (
            await tx
              .select()
              .from(userVocabulary)
              .where(eq(userVocabulary.userId, alice))
          ).length,
          before,
        );

        await tx
          .update(userProgress)
          .set({ activeCourseId: other.id })
          .where(eq(userProgress.userId, alice));
        await assert.rejects(
          saveUserVocabulary(alice, input, tx),
          VocabularyCourseError,
        );
        const security = await tx.execute(
          sql`select relrowsecurity, has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access, has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') as auth_access from pg_class where oid in ('public.user_vocabulary'::regclass,'public.user_vocabulary_links'::regclass)`,
        );
        assert.equal(security.length, 2);
        for (const row of security)
          assert(row.relrowsecurity && !row.anon_access && !row.auth_access);
        throw rollback;
      }),
      (error: unknown) => error === rollback,
    );
  } finally {
    await client.end();
  }
});
