/**
 * Arabic grammar — Zod 4 schemas.
 * SOURCE OF TRUTH: grammar-options.json and grammar-paths.json.
 * THIS FILE contains structural validation + AI descriptions, not a second list
 * of allowed strings. grammar-options.generated.ts is generated from JSON.
 *
 * .describe(): natural-language instructions for AI / JSON Schema export.
 * .meta(): developer/UI hints; Zod 4 may include them in JSON Schema.
 *    Use ai-transport.ts to strip application-only metadata for model calls.
 *
 * AI output: GrammarAiSchema -> full server validation: GrammarSchema.safeParse().
 */
import { z } from "zod";
import { grammarVocabulary as o } from "./grammar-options.generated";
import { checkGrammarPaths } from "./validate-paths";

const numberPerson = z.union([
  z.literal(o.pronoun_features.person[0]),
  z.literal(o.pronoun_features.person[1]),
  z.literal(o.pronoun_features.person[2]),
]).describe("Grammatical person: 1 = speaker, 2 = addressee, 3 = someone/something else.");

const person = numberPerson.meta({ description: "Person 1 = first, 2 = second, 3 = third.", ui: { labelEn: "Person", labelAr: "الشخص" }, developerNote: "Store number 1, 2, or 3, not string labels." });
const prGender = z.enum(o.pronoun_features.gender)
  .describe("Grammatical gender of the pronoun. Use not_distinguished when its form does not mark gender.");
const prNumber = z.enum(o.pronoun_features.number).describe("Pronoun's own number, not the number of the noun or verb it is attached to.");

export const PronounFeaturesSchema = z.strictObject({
  person,
  number: prNumber,
  gender: prGender,
}).meta({ description: "Person, number and grammatical gender of a pronoun, validated separately from its host word.", developerNote: "Further person-number-gender combinations are checked by grammar-paths.json; first person has no separate dual pronoun form." });

export const SegmentSchema = z.strictObject({
  text: z.string().min(1).describe("The exact Arabic substring observed in the word; do not invent a segment."),
  type: z.enum([
    ...o.segmentation.possible_prefix_types,
    ...o.segmentation.possible_suffix_types,
  ]).describe("Morpheme type: prefix or suffix. Additional host-word restrictions are checked after generation."),
}).describe("One identified attached prefix or suffix.");

// Separate prefix and suffix schemas so type-level validation rejects invalid categories.
const PrefixSchema = z.strictObject({
  text: z.string().min(1).describe("Observed Arabic prefix/clitic, e.g. سـ or وَ."),
  type: z.enum(o.segmentation.possible_prefix_types).describe("Prefix classification from grammar-options.json."),
});
const SuffixSchema = z.strictObject({
  text: z.string().min(1).describe("Observed Arabic suffix, e.g. ـهُ."),
  type: z.enum(o.segmentation.possible_suffix_types).describe("Suffix classification from grammar-options.json."),
});

const SegmentationSchema = z.strictObject({
  prefixes: z.array(PrefixSchema).optional().describe("Only prefixes actually observed in the supplied surface form."),
  suffixes: z.array(SuffixSchema).optional().describe("Only suffixes actually observed in the supplied surface form."),
}).meta({ description: "Optional morphological segmentation; absence means no segmented items are recorded.", developerNote: "Do not confuse orthographic segmentation and full sentence syntax. Paths restrict possible host word types." });

const NounPossessorSchema = PronounFeaturesSchema
  .meta({ description: "Grammatical features of a possessive pronoun suffix actually attached to this noun.", ui: { section: "possessor", labelAr: "ضمير الملكية المتصل" }, developerNote: "Omit entirely when no possessive suffix is attached. A separate idafa noun is not an attached possessor." });

export const NounAiSchema = z.strictObject({
  part_of_speech: z.literal("noun"),
  subtype: z.enum(o.parts_of_speech.noun.subtypes).optional()
    .meta({ description: "Classify the nominal word, including adjective, pronoun, active/passive participle or masdar when appropriate.", ui: { order: 1 }, developerNote: "Subtype describes the grammatical class; participle/masdar derivation can be shown separately." }),
  gender: z.enum(o.parts_of_speech.noun.gender).optional()
    .describe("Grammatical gender of the noun. 'unknown' only if ambiguous, not as a substitute for analysis."),
  number: z.enum(o.parts_of_speech.noun.number).optional()
    .describe("Noun's morphological number: singular, dual or plural; use unknown only with insufficient evidence."),
  plural_type: z.enum(o.parts_of_speech.noun.plural_type).optional()
    .meta({ description: "Only classify plural formation when the analysed noun form is plural; omit for singular/dual nouns.", ui: { visibleWhen: { number: "plural" } } }),
  case: z.enum(o.parts_of_speech.noun.case).optional()
    .describe("Grammatical case/indeclinability from trusted vowel marks and sentence position. Unvowelled isolated nouns often have unknown case."),
  definiteness: z.enum(o.parts_of_speech.noun.definiteness).optional()
    .meta({ description: "Nominal definiteness; 'construct' is retained for v1.1 compatibility but is a grammatical state, not true definiteness.", developerNote: "Future v2 migration: move construct out of definiteness into a separate state field; do not assume mudaf is always definite." }),
  definiteness_source: z.enum(o.parts_of_speech.noun.definiteness_source).optional()
    .describe("Observable grammatical reason for definiteness, if one can be identified. Omit if none is present."),
  idafa_role: z.enum(o.parts_of_speech.noun.idafa_role).optional()
    .describe("Role within an idafa construction: mudaf or mudaf_ilayh; omit outside an idafa."),
  rationality: z.enum(o.parts_of_speech.noun.rationality).optional()
    .describe("Whether the referent is grammatically rational (typically human) or non-rational."),
  derivation: z.enum(o.parts_of_speech.noun.derivation).optional()
    .describe("Choose only when the word is an active participle, passive participle, or verbal noun; otherwise omit."),
  possessor: NounPossessorSchema.optional(),
  segmentation: SegmentationSchema.optional(),
}).meta({ description: "An Arabic noun/nominal analysis. Omit features that are absent or inapplicable, never output the literal string 'none'.", title: "Arabic nominal morphology", ui: { labelAr: "الاسم", order: 1 }, developerNote: "Noun subtype/number/definiteness rules are enforced separately using the companion paths file." });

const AttachedPronounSchema = z.strictObject({
  role: z.enum(o.parts_of_speech.verb.attached_pronouns.roles)
    .describe("Subject clitic or direct-object clitic. Never call a preposition-attached object an indirect-object verb suffix."),
  person,
  gender: prGender,
  number: prNumber,
  text: z.string().min(1).optional().describe("Optional exact suffix letters, when segmentation is confident."),
}).meta({ description: "One actual attached pronominal clitic; its grammatical features can differ from the main verb subject.", developerNote: "Repeatable array: e.g. كَتَبْتُهُ has a subject suffix and an object suffix. Not every subject agreement marker is a pronoun clitic." });

const NegationSchema = z.strictObject({
  type: z.enum(o.parts_of_speech.verb.negation.type)
    .describe("normal_negation = statement of non-occurrence; prohibition = negative command using لا الناهية."),
  particle: z.enum(o.parts_of_speech.verb.negation.particle)
    .describe("Only the actual observed negating particle: ما, لا, لم, لن, or other. Do not invent a missing particle."),
}).meta({ description: "An explicitly attested negative/prohibitive construction; omit this entire object if absent.", developerNote: "The particle governs mood, e.g. لن -> subjunctive, لم -> jussive; restrictions are in paths JSON." });

export const VerbAiSchema = z.strictObject({
  part_of_speech: z.literal("verb"),
  aspect: z.enum(o.parts_of_speech.verb.aspect).optional()
    .meta({ description: "Morphological verb form: perfect ماضٍ, imperfect مضارع, imperative أمر. This is not the same as temporal meaning.", ui: { order: 1, labelAr: "زمن الفعل وصيغته" }, developerNote: "Primary selector: drives all other verb field applicability." }),
  person: person.optional().describe("Who the verb is conjugated for. Morphological imperatives take only person 2."),
  number: z.enum(o.parts_of_speech.verb.number).optional()
    .describe("Number in the conjugation: singular, dual, plural. First-person has no distinct dual conjugation."),
  gender: z.enum(o.parts_of_speech.verb.gender).optional()
    .describe("Gender marked by the conjugation. Select not_distinguished for first-person and second-person dual forms."),
  voice: z.enum(o.parts_of_speech.verb.voice).optional()
    .meta({ description: "Active معلوم or passive مجهول. Passive is available in perfect/imperfect, NOT normal morphological imperative. If unvowelled and ambiguous, use unknown.", ui: { dependsOn: ["aspect"] }, developerNote: "AI-added vowel marks are not evidence by themselves: do not guess active/passive from an unvowelled source." }),
  mood: z.enum(o.parts_of_speech.verb.mood).optional()
    .meta({ description: "Only for imperfect verbs: indicative مرفوع, subjunctive منصوب, jussive مجزوم. Determine from ending or governing context; otherwise unknown.", ui: { visibleWhen: { aspect: "imperfect" } }, developerNote: "Omit for perfect and imperative; prohibitive لا takes imperfect jussive." }),
  temporal_meaning: z.enum(o.parts_of_speech.verb.temporal_meaning).optional()
    .describe("Time meaning in context, not verb aspect. If possible senses depend on unstated context choose context_dependent; use unknown when evidence is insufficient."),
  future_marker: z.enum(o.parts_of_speech.verb.future_marker).optional()
    .meta({ description: "Record sa (سـ) or sawfa (سوف) only if actually present. Applicable only to imperfect verbs; omit otherwise.", ui: { visibleWhen: { aspect: "imperfect" } }, developerNote: "A future interpretation alone does not imply an explicit future marker." }),
  energetic_nun: z.enum(o.parts_of_speech.verb.energetic_nun).optional()
    .describe("Emphatic نون التوكيد, heavy (نَّ) or light (نْ). Omit if absent; do not confuse it with the ordinary imperfect mood."),
  verb_form: z.enum(o.parts_of_speech.verb.verb_form).optional()
    .describe("Morphological triliteral Form I–X; other for identified non-I–X patterns, unknown if undetermined. Form I is basic, not derived."),
  negation: NegationSchema.optional(),
  attached_pronouns: z.array(AttachedPronounSchema).optional()
    .meta({ description: "Only actual attached pronoun clitics; omit or provide empty array if none. Each item has independent grammatical features.", ui: { repeatable: true }, developerNote: "Avoid counting the same grammatical suffix twice as separate pronoun and agreement when not warranted." }),
  weakness: z.enum(o.parts_of_speech.verb.weakness).optional()
    .describe("Root morphology: sound, hamzated, doubled, assimilated, hollow, defective, lafif, etc. Derive from root, not spelling alone."),
  transitivity: z.enum(o.parts_of_speech.verb.transitivity).optional()
    .describe("Lexical capacity to take a direct object; don't infer intransitivity simply because the sentence omits an object."),
  segmentation: SegmentationSchema.optional(),
}).meta({ description: "An Arabic verb analysis: output only features confidently evidenced by the verb or provided context; otherwise use unknown when applicable, or omit when absent/inapplicable.", title: "Arabic verb morphology", ui: { labelAr: "الفعل", order: 2 }, developerNote: "Run grammar-paths.json validation AFTER structural Zod parsing, before saving or showing final badges." });

export const ParticleAiSchema = z.strictObject({
  part_of_speech: z.literal("particle"),
  subtype: z.enum(o.parts_of_speech.particle.subtypes).optional()
    .describe("The grammatical category of this particle, e.g. preposition, negation, prohibition, conjunction, subjunctive governor."),
  grammatical_effect: z.array(z.enum(o.parts_of_speech.particle.grammatical_effect)).optional()
    .meta({ description: "Zero or more observed grammatical effects. Multiple effects may coexist, e.g. لن marks negation and causes subjunctive. Omit if none of the listed effects apply.", ui: { multiple: true }, developerNote: "Plural intentionally: a particle can both mark negation and govern a mood. No 'none' choice." }),
  segmentation: SegmentationSchema.optional(),
}).meta({ description: "An Arabic particle/harf analysis, with only applicable grammatical effects.", title: "Arabic particle", ui: { labelAr: "الحرف", order: 3 } });

/** AI-safe structural schema. Does not include complex cross-field .superRefine rules. */
export const GrammarAiSchema = z.discriminatedUnion("part_of_speech", [
  NounAiSchema, VerbAiSchema, ParticleAiSchema,
]).meta({ description: "Analyse one Modern Standard Arabic word/morpheme, using the original spelling and available sentence context. Do not invent context, vowels, affixes, or unseen governing particles. Use unknown only for applicable but indeterminate fields; omit absent or inapplicable fields. Never emit 'none'.", developerNote: "For a model call use ai-transport.ts, which removes local-only metadata from the provider schema. Cross-field rules are checked after output." });

export type GrammarAnalysis = z.infer<typeof GrammarAiSchema>;
export type NounAnalysis = z.infer<typeof NounAiSchema>;
export type VerbAnalysis = z.infer<typeof VerbAiSchema>;
export type ParticleAnalysis = z.infer<typeof ParticleAiSchema>;

/** Full validation for AI results, manual edits, imports, and DB writes. */
export const GrammarSchema = GrammarAiSchema.superRefine((data, ctx) => {
  for (const issue of checkGrammarPaths(data)) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
}).meta({ developerNote: "Use .safeParse() on the server after AI generation and after manual edits. Do not use this refined schema as your provider's structured-output contract." });

export function parseGrammarForStorage(input: unknown): GrammarAnalysis {
  return GrammarSchema.parse(input);
}
