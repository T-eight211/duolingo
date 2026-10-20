import "server-only";

import {
  createGateway,
  generateText,
  Output,
  type LanguageModel,
} from "ai";
import { DEFAULT_VOCABULARY_MODEL } from "@/lib/vocabulary/extract";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";
import {
  GrammarSchema,
  type ArabicGrammar,
} from "@/lib/arabic-grammar";
import { grammarAnalysisBatchSchema } from "./schema";

export const ARABIC_GRAMMAR_ANALYSIS_INSTRUCTIONS = `You are an expert Arabic grammarian analysing vocabulary according to Modern Standard Arabic (العربية الفصحى / MSA).

Analyse the grammatical characteristics of the provided Arabic words according to the structured Arabic grammar schema.

CRITICAL GRAMMAR RULES:
1. PRIMARY CLASSIFICATION:
   Classify each word into exactly one of the three primary Arabic parts of speech:
   - noun (اسم)
   - verb (فعل)
   - particle (حرف)

2. NOMINALS / NOUNS (اسم):
   - Verbal nouns (المصدر / masdar, e.g. عَمَل, سَفَر, كِتَابَة, اِسْتِطَاعَة) MUST be classified as noun with subtype="verbal_noun" and derivation="verbal_noun". They are nominal forms, NEVER verbs.
   - Participles (اسم فاعل / اسم مفعول) are nouns with subtype and derivation "active_participle" or "passive_participle".
   - Adjectives (صفة), pronouns (ضمير), demonstratives (اسم إشارة), relative pronouns (اسم موصول), and numerals (عدد) are all classified under noun with the appropriate subtype.
   - For isolated words without a sentence context, DO NOT arbitrarily assume nominative case; omit case or use case="unknown".
   - Plural type (sound_masculine, sound_feminine, broken) applies ONLY when number="plural". Omit for singular/dual nouns.
   - Attached possessive pronouns (e.g. كِتَابُهُ -> possessor person 3, masculine, singular) must be recorded under possessor. Omit possessor if none is attached.

3. VERBS (فعل):
   - Identify aspect: perfect (ماضٍ), imperfect (مضارع), or imperative (أمر).
   - Imperative verbs (أمر): active voice only, second person only (person=2). They NEVER take mood, future markers, or negation.
   - Mood (indicative, subjunctive, jussive): applies ONLY to imperfect verbs. Omit for perfect and imperative verbs.
   - Future markers (sa / sawfa): apply ONLY to imperfect indicative verbs with future meaning. Omit otherwise.
   - Negation / Prohibition:
     - Negative commands (نهي, e.g. لا تَكْتُبْ) are imperfect jussive with negation.type="prohibition" and particle="لا". They are NEVER morphological imperatives.
     - لن requires imperfect subjunctive with future temporal meaning.
     - لم requires imperfect jussive with past temporal meaning.
   - Person/number agreement: first person has no dual conjugation and is never marked for gender (gender="not_distinguished"). Second-person dual also uses gender="not_distinguished".
   - Identify standard Arabic verb forms (الأوزان): I, II, III, IV, V, VI, VII, VIII, IX, X.
   - Identify weakness type (sound, hamzated, doubled, assimilated, hollow, defective, lafif).

4. PARTICLES (حرف):
   - Identify subtype: preposition (حرف جر), conjunction (حرف عطف), negation (نفي), interrogative (استفهام), future (استقبال), etc.
   - Identify grammatical effect as an array of zero or more observed effects (e.g. ["governs_genitive"] or ["marks_negation", "causes_subjunctive"]).

5. VALUE POLICY (NO "none"):
   - NEVER output the literal string "none" or "not_applicable".
   - If a feature is absent, inapplicable, or not supplied, OMIT the property entirely.
   - Use "unknown" only when a feature is applicable but cannot be reliably determined from the available evidence.

6. CONTEXT AWARENESS:
   - If a sentence context is provided, use it to determine case, mood, idafa role, and contextual function.
   - If no sentence context is available (isolated word), only populate characteristics that can be reliably determined from the word itself.

Do not invent missing grammatical characteristics. Adhere strictly to the enum values in the schema.`;

type GrammarOptions = {
  model?: LanguageModel;
  abortSignal?: AbortSignal;
};

function configuredModel(): LanguageModel {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Vercel AI Gateway API key is not configured.");
  }
  const gateway = createGateway({ apiKey });
  return gateway(
    process.env.ARABIC_GRAMMAR_MODEL ||
      process.env.VOCABULARY_AI_MODEL ||
      DEFAULT_VOCABULARY_MODEL,
  );
}

export async function analyzeVocabularyGrammar(
  entries: VocabularyEntry[],
  options: GrammarOptions = {},
): Promise<VocabularyEntry[]> {
  const wordsToAnalyze = entries.filter((e) => e.kind === "word");
  if (wordsToAnalyze.length === 0) return entries;

  // Build sentence context lookup
  const sentenceMap = new Map(
    entries
      .filter((e) => e.kind !== "word")
      .map((s) => [s.id, s.arabicDiacritized || s.arabic]),
  );

  const payload = wordsToAnalyze.map((word) => {
    const contextSentence = word.sourceIds
      .map((id) => sentenceMap.get(id))
      .filter(Boolean)
      .join(" | ");
    return {
      id: word.id,
      arabic: word.arabic,
      arabicDiacritized: word.arabicDiacritized || word.arabic,
      english: word.english,
      contextSentence: contextSentence || null,
    };
  });

  const CHUNK_SIZE = 8;
  const chunks: (typeof payload)[] = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    chunks.push(payload.slice(i, i + CHUNK_SIZE));
  }

  const model = options.model ?? configuredModel();

  try {
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        generateText({
          model,
          output: Output.object({
            name: "ArabicGrammarBatchAnalysis",
            description:
              "Batch Arabic grammatical analysis for extracted vocabulary words.",
            schema: grammarAnalysisBatchSchema,
          }),
          system: ARABIC_GRAMMAR_ANALYSIS_INSTRUCTIONS,
          messages: [
            {
              role: "user",
              content:
                "Analyse the grammatical characteristics of each of these Arabic words according to Modern Standard Arabic grammar rules. IMPORTANT: You must return an analysis for EVERY word in the payload, preserving the exact 'id' for each item in the same order:\n" +
                JSON.stringify(chunk, null, 2),
            },
          ],
          maxOutputTokens: 8_000,
          abortSignal: options.abortSignal,
        }),
      ),
    );

    const allAnalyses = chunkResults.flatMap((r) => r.output.analyses);
    const analysisById = new Map<string, ArabicGrammar>();
    const analysesList: ArabicGrammar[] = [];

    for (const item of allAnalyses) {
      const { id, ...rawFields } = item;
      // Clean null, "null", or empty string values so only populated grammatical features remain
      const cleanedGrammar: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawFields)) {
        if (v !== null && v !== undefined && v !== "" && v !== "null") {
          cleanedGrammar[k] = v;
        }
      }

      const validated = GrammarSchema.safeParse(cleanedGrammar);
      const grammar: ArabicGrammar = validated.success
        ? validated.data
        : (cleanedGrammar as ArabicGrammar);

      if (id) {
        analysisById.set(id, grammar);
        analysisById.set(id.trim().toLowerCase(), grammar);
      }
      analysesList.push(grammar);
    }

    let wordIndex = 0;
    return entries.map((entry) => {
      if (entry.kind !== "word") return entry;
      const currentIdx = wordIndex++;
      const grammar =
        analysisById.get(entry.id) ??
        analysisById.get(entry.id.trim().toLowerCase()) ??
        analysesList[currentIdx];

      if (!grammar) return entry;
      return {
        ...entry,
        partOfSpeech: grammar.part_of_speech,
        grammar,
      };
    });
  } catch (err) {
    // Graceful degradation: never fail vocabulary extraction because of grammar analysis
    console.error("Arabic grammar analysis encountered an error:", err);
    return entries;
  }
}

export async function analyzeSingleWordGrammar(
  word: {
    id: string;
    arabic: string;
    arabicDiacritized?: string | null;
    english: string;
    contextSentence?: string | null;
  },
  options: GrammarOptions = {},
): Promise<ArabicGrammar | null> {
  try {
    const { output } = await generateText({
      model: options.model ?? configuredModel(),
      output: Output.object({
        name: "ArabicGrammarSingleAnalysis",
        description:
          "Arabic grammatical analysis for a single vocabulary word.",
        schema: grammarAnalysisBatchSchema,
      }),
      system: ARABIC_GRAMMAR_ANALYSIS_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content:
            "Analyse the grammatical characteristics of this Arabic word in Modern Standard Arabic:\n" +
            JSON.stringify(
              [
                {
                  id: word.id,
                  arabic: word.arabic,
                  arabicDiacritized: word.arabicDiacritized || word.arabic,
                  english: word.english,
                  contextSentence: word.contextSentence || null,
                },
              ],
              null,
              2,
            ),
        },
      ],
      abortSignal: options.abortSignal,
    });

    const first = output.analyses[0];
    if (!first) return null;
    const { id, ...grammarFields } = first;
    const validated = GrammarSchema.safeParse(grammarFields);
    return validated.success
      ? validated.data
      : (grammarFields as ArabicGrammar);
  } catch (err) {
    console.error("Single word grammar analysis error:", err);
    return null;
  }
}
