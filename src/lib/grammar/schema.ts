import { z } from "zod";
import {
  GrammarSchema,
  GrammarAiSchema,
  normalizeGrammarAnalysis,
  type GrammarAnalysis,
} from "@/lib/arabic-grammar";
import { grammarVocabulary as o } from "@/lib/arabic-grammar/grammar-options.generated";

export {
  GrammarSchema,
  GrammarAiSchema,
  normalizeGrammarAnalysis,
};

export const partOfSpeechEnum = z.enum(["noun", "verb", "particle"]);

/**
 * Universal schema for Arabic grammar, accepting both new canonical v1.1 flat format
 * and normalized legacy nested objects for complete backward compatibility.
 */
export const arabicGrammarSchema = z.preprocess(
  (val) => normalizeGrammarAnalysis(val),
  GrammarSchema,
);

/**
 * OpenAI / Structured Output compatible flat schema:
 * Providers using OpenAI Structured Outputs (like openai/gpt-4o-mini via Vercel AI Gateway)
 * reject JSON Schema 'allOf' / 'oneOf' and require all properties in 'required' (nullable instead of optional).
 */
export const flatGrammarAnalysisSchema = z.object({
  id: z.string().describe("The exact ID of the word from the input payload."),
  part_of_speech: z.enum(["noun", "verb", "particle"]).describe("Primary part of speech."),
  subtype: z.string().nullable().describe("Category subtype from grammar options (e.g. preposition, relative_pronoun, verbal_noun, proper_noun). Null if none."),
  aspect: z.enum(o.parts_of_speech.verb.aspect).nullable().describe("Verb aspect: perfect (past), imperfect (present), imperative (command). Null for non-verbs."),
  person: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().describe("Conjugation person (1, 2, or 3). Null if non-applicable."),
  number: z.enum(["singular", "dual", "plural", "unknown"]).nullable().describe("Grammatical number. Null if non-applicable."),
  gender: z.enum(["masculine", "feminine", "not_distinguished", "unknown"]).nullable().describe("Grammatical gender. Null if non-applicable."),
  voice: z.enum(o.parts_of_speech.verb.voice).nullable().describe("Active or passive voice for verbs. Null if non-applicable."),
  mood: z.enum(o.parts_of_speech.verb.mood).nullable().describe("Indicative, subjunctive, or jussive for imperfect verbs. Null if non-applicable."),
  case: z.enum(o.parts_of_speech.noun.case).nullable().describe("Nominative, accusative, genitive, indeclinable, or unknown for nouns. Null if non-applicable."),
  definiteness: z.enum(o.parts_of_speech.noun.definiteness).nullable().describe("Definite, indefinite, construct, or unknown for nouns. Null if non-applicable."),
  plural_type: z.enum(o.parts_of_speech.noun.plural_type).nullable().describe("Plural type (broken, sound_masculine, sound_feminine) for plural nouns. Null if non-applicable."),
  verb_form: z.enum(o.parts_of_speech.verb.verb_form).nullable().describe("Triliteral verb Form I-X. Null if non-applicable."),
  derivation: z.enum(o.parts_of_speech.noun.derivation).nullable().describe("Active participle, passive participle, or verbal noun derivation for nominals. Null if non-applicable."),
  weakness: z.enum(o.parts_of_speech.verb.weakness).nullable().describe("Root morphology type (sound, hollow, defective, etc.). Null if non-applicable."),
  grammatical_effect: z.array(z.string()).nullable().describe("Array of grammatical effects for particles. Null if non-applicable."),
});

export const grammarAnalysisBatchSchema = z.object({
  analyses: z.array(flatGrammarAnalysisSchema),
});

export type ArabicGrammarOutput = GrammarAnalysis;
export type SingleWordGrammarOutput = z.infer<
  typeof flatGrammarAnalysisSchema
>;
