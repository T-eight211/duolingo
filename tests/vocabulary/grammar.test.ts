import assert from "node:assert/strict";
import test from "node:test";
import { arabicGrammarSchema } from "../../src/lib/grammar/schema";
import {
  getPartOfSpeechLabel,
  getCategoryLabel,
  getValueLabel,
  getGrammarSummaryBadges,
  getAllowedCategoryValues,
} from "../../src/lib/grammar/translations";
import {
  vocabularyEntrySchema,
  saveVocabularySchema,
} from "../../src/lib/vocabulary/schema";
import { prepareVocabularySave } from "../../src/db/vocabulary-plan";
import type { ArabicGrammar } from "../../src/lib/grammar/types";
import { word } from "./fixtures";

test("arabicGrammarSchema validates nouns, verbs, particles and rejects invalid values", () => {
  // Valid noun (e.g. كِتَابٌ - nominative, indefinite, masculine singular common noun)
  const nounGrammar: ArabicGrammar = {
    part_of_speech: "noun",
    subtype: "common_noun",
    gender: "masculine",
    number: "singular",
    case: "nominative",
    definiteness: "indefinite",
    rationality: "non_rational",
  };
  const parsedNoun = arabicGrammarSchema.safeParse(nounGrammar);
  assert.equal(parsedNoun.success, true);

  // Masdar / Verbal noun must be classified as noun
  const masdarGrammar: ArabicGrammar = {
    part_of_speech: "noun",
    subtype: "verbal_noun",
    derivation: "verbal_noun",
    gender: "masculine",
    number: "singular",
    case: "unknown",
    definiteness: "unknown",
  };
  assert.equal(arabicGrammarSchema.safeParse(masdarGrammar).success, true);

  // Valid verb (e.g. كَتَبَ - Form I, 3rd person masculine singular perfect)
  const verbGrammar: ArabicGrammar = {
    part_of_speech: "verb",
    aspect: "perfect",
    temporal_meaning: "past",
    person: 3,
    gender: "masculine",
    number: "singular",
    voice: "active",
    verb_form: "I",
    transitivity: "transitive",
    weakness: "sound",
  };
  const parsedVerb = arabicGrammarSchema.safeParse(verbGrammar);
  assert.equal(parsedVerb.success, true);

  // Valid particle (e.g. فِي - preposition)
  const particleGrammar: ArabicGrammar = {
    part_of_speech: "particle",
    subtype: "preposition",
    grammatical_effect: ["governs_genitive"],
  };
  assert.equal(arabicGrammarSchema.safeParse(particleGrammar).success, true);

  // Rejection of invalid part of speech
  assert.equal(
    arabicGrammarSchema.safeParse({ part_of_speech: "adjective" }).success,
    false,
  );

  // Rejection of invalid verb aspect
  assert.equal(
    arabicGrammarSchema.safeParse({
      part_of_speech: "verb",
      aspect: "non_existent_aspect",
    }).success,
    false,
  );
});

test("grammar translations dynamically resolve labels and allowed options from JSON", () => {
  // Part of speech labels
  const nounPosLabel = getPartOfSpeechLabel("noun");
  assert.equal(nounPosLabel.arabic, "اسم");
  assert.equal(nounPosLabel.english, "Noun");

  const verbPosLabel = getPartOfSpeechLabel("verb");
  assert.equal(verbPosLabel.arabic, "فعل");
  assert.equal(verbPosLabel.english, "Verb");

  const particlePosLabel = getPartOfSpeechLabel("particle");
  assert.equal(particlePosLabel.arabic, "حرف");
  assert.equal(particlePosLabel.english, "Particle");

  // Category labels
  const genderCatLabel = getCategoryLabel("noun", "gender");
  assert.equal(genderCatLabel.arabic, "الجنس");
  assert.equal(genderCatLabel.english, "Gender");

  // Value labels
  const mascLabel = getValueLabel("noun", "gender", "masculine");
  assert.equal(mascLabel.arabic, "مذكر");
  assert.equal(mascLabel.english, "Masculine");

  // Allowed options for category
  const genderOptions = getAllowedCategoryValues("noun", "gender");
  assert.equal(genderOptions.length > 0, true);
  assert.equal(
    genderOptions.some((o) => o.value === "masculine"),
    true,
  );
});

test("getGrammarSummaryBadges produces compact dual-language badges", () => {
  const nounGrammar: ArabicGrammar = {
    part_of_speech: "noun",
    subtype: "common_noun",
    gender: "masculine",
    number: "singular",
    definiteness: "definite",
  };

  const badges = getGrammarSummaryBadges(nounGrammar);
  assert.equal(badges.length >= 3, true);
  assert.equal(badges[0].id, "pos");
  assert.equal(badges[0].arabic, "اسم");
  assert.equal(badges[0].english, "Noun");

  const verbGrammar: ArabicGrammar = {
    part_of_speech: "verb",
    aspect: "perfect",
    person: 3,
    gender: "masculine",
    number: "singular",
  };

  const verbBadges = getGrammarSummaryBadges(verbGrammar);
  assert.equal(verbBadges.length >= 3, true);
  assert.equal(verbBadges[0].id, "pos");
  assert.equal(verbBadges.some((b) => b.id === "aspect"), true);

  const particleGrammar: ArabicGrammar = {
    part_of_speech: "particle",
    subtype: "preposition",
  };

  const particleBadges = getGrammarSummaryBadges(particleGrammar);
  assert.equal(particleBadges.length >= 2, true);
  assert.equal(particleBadges[0].id, "pos");
  assert.equal(particleBadges[1].id, "subtype");
});

test("vocabularyEntrySchema and saveVocabularySchema preserve grammar classifications", () => {
  const grammar: ArabicGrammar = {
    part_of_speech: "noun",
    subtype: "verbal_noun",
    gender: "masculine",
    number: "singular",
    case: "nominative",
  };

  const entry = word({
    partOfSpeech: "noun",
    grammar,
  });

  const parsedEntry = vocabularyEntrySchema.safeParse(entry);
  assert.equal(parsedEntry.success, true);
  if (parsedEntry.success) {
    assert.equal(parsedEntry.data.partOfSpeech, "noun");
    assert.equal(
      (parsedEntry.data.grammar as any)?.subtype ??
        (parsedEntry.data.grammar as any)?.noun?.subtype,
      "verbal_noun",
    );
  }

  const saveParsed = saveVocabularySchema.safeParse({ entries: [entry] });
  assert.equal(saveParsed.success, true);

  const plan = prepareVocabularySave([entry]);
  assert.equal(plan.entries[0].partOfSpeech, "noun");
  assert.deepEqual(plan.entries[0].grammar, grammar);
});
