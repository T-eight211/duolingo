import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanEnglishTranslation,
  hasEnglishMetadataAnnotation,
} from "../../src/lib/vocabulary/clean-translation";

test("cleanEnglishTranslation strips gender and number brackets", () => {
  assert.equal(cleanEnglishTranslation("first (m)"), "first");
  assert.equal(cleanEnglishTranslation("firsts (m)"), "firsts");
  assert.equal(cleanEnglishTranslation("first (f)"), "first");
  assert.equal(cleanEnglishTranslation("firsts (f)"), "firsts");
  assert.equal(cleanEnglishTranslation("Turkish (m)"), "Turkish");
  assert.equal(cleanEnglishTranslation("Syrian (f)"), "Syrian");
  assert.equal(cleanEnglishTranslation("student (m/f)"), "student");
  assert.equal(cleanEnglishTranslation("teacher (f.)"), "teacher");
  assert.equal(cleanEnglishTranslation("doctor [m]"), "doctor");
  assert.equal(cleanEnglishTranslation("books (pl.)"), "books");
  assert.equal(cleanEnglishTranslation("book (sing.)"), "book");
});

test("cleanEnglishTranslation strips grammatical and textbook notes", () => {
  assert.equal(cleanEnglishTranslation("he went (past)"), "he went");
  assert.equal(cleanEnglishTranslation("he goes (present)"), "he goes");
  assert.equal(cleanEnglishTranslation("to speak - verb"), "to speak");
  assert.equal(cleanEnglishTranslation("doctor - m"), "doctor");
  assert.equal(cleanEnglishTranslation("beautiful (adj)"), "beautiful");
  assert.equal(cleanEnglishTranslation("quickly (adv)"), "quickly");
  assert.equal(cleanEnglishTranslation("good morning (formal)"), "good morning");
  assert.equal(cleanEnglishTranslation("hello (lit. peace)"), "hello");
});

test("cleanEnglishTranslation handles slash and dash combinations cleanly", () => {
  assert.equal(
    cleanEnglishTranslation("Turkish (m) / Turkish (f)"),
    "Turkish",
  );
  // Normalizes comma and semicolon separated alternatives into consistent " / "
  assert.equal(
    cleanEnglishTranslation("Colleague, classmate"),
    "Colleague / classmate",
  );
  assert.equal(
    cleanEnglishTranslation("Colleagues, classmates"),
    "Colleagues / classmates",
  );
  assert.equal(cleanEnglishTranslation("read, recite"), "read / recite");
  assert.equal(cleanEnglishTranslation("read; recite"), "read / recite");
  assert.equal(cleanEnglishTranslation("read/recite"), "read / recite");
  // Preserves genuine alternative meanings
  assert.equal(cleanEnglishTranslation("big / large"), "big / large");
  assert.equal(
    cleanEnglishTranslation("to read / recite"),
    "to read / recite",
  );
});

test("hasEnglishMetadataAnnotation detects annotations accurately", () => {
  assert.equal(hasEnglishMetadataAnnotation("first (m)"), true);
  assert.equal(hasEnglishMetadataAnnotation("Turkish (m)"), true);
  assert.equal(hasEnglishMetadataAnnotation("books (pl.)"), true);
  assert.equal(hasEnglishMetadataAnnotation("to speak - verb"), true);
  assert.equal(hasEnglishMetadataAnnotation("first"), false);
  assert.equal(hasEnglishMetadataAnnotation("big / large"), false);
  assert.equal(hasEnglishMetadataAnnotation(""), false);
  assert.equal(hasEnglishMetadataAnnotation(null), false);
});
