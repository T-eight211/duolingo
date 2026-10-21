import { describe, it, expect } from "vitest";
import {
  GrammarSchema,
  getAllowedVerbChoices,
  getAllowedNounChoices,
  getAllowedNounPluralTypes,
  getAllowedParticleEffects,
} from "../src/lib/arabic-grammar";

describe("Arabic Grammar Constraints & Path Validation", () => {
  describe("Imperative verbs", () => {
    it("accepts valid second-person active imperatives without mood or future marker", () => {
      const valid = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "singular",
        gender: "masculine",
        voice: "active",
      });
      expect(valid.success).toBe(true);
    });

    it("accepts dual imperative with not_distinguished gender", () => {
      const valid = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "dual",
        gender: "not_distinguished",
        voice: "active",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects imperatives conjugated for 1st or 3rd person", () => {
      const p1 = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 1,
        number: "singular",
        gender: "not_distinguished",
      });
      expect(p1.success).toBe(false);

      const p3 = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 3,
        number: "singular",
        gender: "masculine",
      });
      expect(p3.success).toBe(false);
    });

    it("rejects passive voice for imperative", () => {
      const passive = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "singular",
        gender: "masculine",
        voice: "passive",
      });
      expect(passive.success).toBe(false);
    });

    it("rejects mood on imperative", () => {
      const withMood = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
      });
      expect(withMood.success).toBe(false);
    });

    it("rejects future marker on imperative", () => {
      const withFuture = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "singular",
        gender: "masculine",
        future_marker: "sa",
      });
      expect(withFuture.success).toBe(false);
    });

    it("rejects negation or prohibition on morphological imperative", () => {
      const negated = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperative",
        person: 2,
        number: "singular",
        gender: "masculine",
        negation: {
          type: "prohibition",
          particle: "لا",
        },
      });
      expect(negated.success).toBe(false);
    });
  });

  describe("Prohibitions vs ordinary negation", () => {
    it("accepts valid prohibition (لا الناهية) with imperfect jussive", () => {
      const validProhibition = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 2,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
        negation: {
          type: "prohibition",
          particle: "لا",
        },
      });
      expect(validProhibition.success).toBe(true);
    });

    it("rejects prohibition with indicative mood", () => {
      const invalid = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 2,
        number: "singular",
        gender: "masculine",
        mood: "indicative",
        negation: {
          type: "prohibition",
          particle: "لا",
        },
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects prohibition particle other than لا", () => {
      const invalid = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 2,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
        negation: {
          type: "prohibition",
          particle: "ما",
        },
      });
      expect(invalid.success).toBe(false);
    });

    it("requires indicative mood for ordinary imperfect negation with لا", () => {
      const ordinaryLa = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "indicative",
        negation: {
          type: "normal_negation",
          particle: "لا",
        },
      });
      expect(ordinaryLa.success).toBe(true);

      const invalidOrdinaryLa = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
        negation: {
          type: "normal_negation",
          particle: "لا",
        },
      });
      expect(invalidOrdinaryLa.success).toBe(false);
    });
  });

  describe("Negation governors (لن and لم)", () => {
    it("validates لن requires imperfect subjunctive with future meaning", () => {
      const validLan = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "subjunctive",
        temporal_meaning: "future",
        negation: {
          type: "normal_negation",
          particle: "لن",
        },
      });
      expect(validLan.success).toBe(true);

      const invalidLan = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
        negation: {
          type: "normal_negation",
          particle: "لن",
        },
      });
      expect(invalidLan.success).toBe(false);
    });

    it("validates لم requires imperfect jussive with past meaning", () => {
      const validLam = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "jussive",
        temporal_meaning: "past",
        negation: {
          type: "normal_negation",
          particle: "لم",
        },
      });
      expect(validLam.success).toBe(true);

      const invalidLam = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "indicative",
        negation: {
          type: "normal_negation",
          particle: "لم",
        },
      });
      expect(invalidLam.success).toBe(false);
    });
  });

  describe("Future markers", () => {
    it("accepts sa / sawfa on imperfect indicative verbs", () => {
      const validSa = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "imperfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        mood: "indicative",
        temporal_meaning: "future",
        future_marker: "sa",
      });
      expect(validSa.success).toBe(true);
    });

    it("rejects future marker on perfect or imperative verbs", () => {
      const perfectFuture = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 3,
        number: "singular",
        gender: "masculine",
        future_marker: "sa",
      });
      expect(perfectFuture.success).toBe(false);
    });
  });

  describe("Person, number and gender agreement combinations", () => {
    it("rejects first-person dual in verb conjugation", () => {
      const p1Dual = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 1,
        number: "dual",
        gender: "not_distinguished",
      });
      expect(p1Dual.success).toBe(false);
    });

    it("requires not_distinguished gender for first person", () => {
      const p1Masc = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 1,
        number: "singular",
        gender: "masculine",
      });
      expect(p1Masc.success).toBe(false);

      const p1NotDist = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 1,
        number: "singular",
        gender: "not_distinguished",
      });
      expect(p1NotDist.success).toBe(true);
    });

    it("requires not_distinguished gender for second-person dual", () => {
      const p2DualMasc = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 2,
        number: "dual",
        gender: "masculine",
      });
      expect(p2DualMasc.success).toBe(false);

      const p2DualOk = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        person: 2,
        number: "dual",
        gender: "not_distinguished",
      });
      expect(p2DualOk.success).toBe(true);
    });
  });

  describe("Noun plurals", () => {
    it("allows plural_type only when number is plural", () => {
      const validPlural = GrammarSchema.safeParse({
        part_of_speech: "noun",
        subtype: "common_noun",
        number: "plural",
        plural_type: "broken",
      });
      expect(validPlural.success).toBe(true);

      const invalidSingular = GrammarSchema.safeParse({
        part_of_speech: "noun",
        subtype: "common_noun",
        number: "singular",
        plural_type: "broken",
      });
      expect(invalidSingular.success).toBe(false);

      const invalidDual = GrammarSchema.safeParse({
        part_of_speech: "noun",
        subtype: "common_noun",
        number: "dual",
        plural_type: "sound_masculine",
      });
      expect(invalidDual.success).toBe(false);
    });

    it("provides allowed plural types via helper only for plural number", () => {
      expect(getAllowedNounPluralTypes("plural").length).toBeGreaterThan(0);
      expect(getAllowedNounPluralTypes("singular")).toEqual([]);
      expect(getAllowedNounPluralTypes("dual")).toEqual([]);
      expect(getAllowedNounPluralTypes(undefined)).toEqual([]);
    });
  });

  describe("Particle multiple effects", () => {
    it("supports zero, one, or multiple grammatical effects as an array", () => {
      const zeroEffects = GrammarSchema.safeParse({
        part_of_speech: "particle",
        subtype: "conjunction",
      });
      expect(zeroEffects.success).toBe(true);

      const singleEffect = GrammarSchema.safeParse({
        part_of_speech: "particle",
        subtype: "preposition",
        grammatical_effect: ["governs_genitive"],
      });
      expect(singleEffect.success).toBe(true);

      const multipleEffects = GrammarSchema.safeParse({
        part_of_speech: "particle",
        subtype: "negation",
        grammatical_effect: ["marks_negation", "causes_subjunctive"],
      });
      expect(multipleEffects.success).toBe(true);
    });

    it("rejects duplicate effects in array", () => {
      const duplicate = GrammarSchema.safeParse({
        part_of_speech: "particle",
        subtype: "negation",
        grammatical_effect: ["marks_negation", "marks_negation"],
      });
      expect(duplicate.success).toBe(false);
    });

    it("provides allowed effects by subtype via helper", () => {
      const prepEffects = getAllowedParticleEffects("preposition");
      expect(prepEffects).toContain("governs_genitive");
      expect(getAllowedParticleEffects("unknown_subtype")).toEqual([]);
    });
  });

  describe("Value policy: rejection of string 'none'", () => {
    it("rejects literal string 'none' in verb fields", () => {
      const result = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        future_marker: "none",
      });
      expect(result.success).toBe(false);
    });

    it("rejects literal string 'none' in noun fields", () => {
      const result = GrammarSchema.safeParse({
        part_of_speech: "noun",
        subtype: "common_noun",
        idafa_role: "none",
      });
      expect(result.success).toBe(false);
    });

    it("rejects literal string 'none' in particle effects", () => {
      const result = GrammarSchema.safeParse({
        part_of_speech: "particle",
        subtype: "preposition",
        grammatical_effect: ["none"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects literal string 'none' in negation", () => {
      const result = GrammarSchema.safeParse({
        part_of_speech: "verb",
        aspect: "perfect",
        negation: {
          particle: "none",
          type: "none",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UI helper functions", () => {
    it("getAllowedVerbChoices correctly constrains imperative", () => {
      const choices = getAllowedVerbChoices({
        aspect: "imperative",
        person: 2,
        number: "dual",
      });
      expect(choices.person).toEqual([2]);
      expect(choices.gender).toEqual(["not_distinguished"]);
      expect(choices.mood).toEqual([]);
      expect(choices.voice).toEqual(["active"]);
      expect(choices.future_marker).toEqual([]);
    });

    it("getAllowedNounChoices correctly constrains proper_noun to definite", () => {
      const choices = getAllowedNounChoices({
        subtype: "proper_noun",
      });
      expect(choices.definiteness).toEqual(["definite"]);
      expect(choices.definiteness_source).toEqual(["proper_noun"]);
    });

    it("getAllowedNounChoices excludes definite-only subtypes when indefinite", () => {
      const choices = getAllowedNounChoices({
        definiteness: "indefinite",
      });
      expect(choices.subtypes).not.toContain("proper_noun");
      expect(choices.subtypes).not.toContain("pronoun");
      expect(choices.subtypes).not.toContain("demonstrative");
      expect(choices.subtypes).not.toContain("relative_pronoun");
      expect(choices.definiteness_source).toEqual([]);
    });

    it("getAllowedNounChoices constrains active_participle derivation", () => {
      const choices = getAllowedNounChoices({
        subtype: "active_participle",
      });
      expect(choices.derivation).toEqual(["active_participle"]);
    });

    it("getAllowedNounChoices constrains possessor agreement paths", () => {
      const choices = getAllowedNounChoices({
        possessor: { person: 1 },
      });
      expect(choices.possessor.number).toEqual(["singular", "plural"]);
      expect(choices.possessor.gender).toEqual(["not_distinguished"]);
    });
  });
});
