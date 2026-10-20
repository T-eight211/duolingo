/**
 * Arabic grammar library — safe exports for client editor and server validation.
 * Does not export AI transport; import from '@/lib/arabic-grammar/ai-transport' for model calls.
 */

export {
  GrammarSchema,
  GrammarAiSchema,
  NounAiSchema,
  VerbAiSchema,
  ParticleAiSchema,
  PronounFeaturesSchema,
  SegmentSchema,
  parseGrammarForStorage,
} from "./schema";

export type {
  GrammarAnalysis,
  GrammarAnalysis as ArabicGrammar,
  NounAnalysis,
  NounAnalysis as NounGrammar,
  VerbAnalysis,
  VerbAnalysis as VerbGrammar,
  ParticleAnalysis,
  ParticleAnalysis as ParticleGrammar,
} from "./schema";

export {
  checkGrammarPaths,
  getAllowedVerbChoices,
  getAllowedNounPluralTypes,
  getAllowedParticleEffects,
} from "./validate-paths";

export type { GrammarIssue } from "./validate-paths";

export {
  grammarOptions,
  grammarVocabulary,
} from "./grammar-options.generated";

export {
  getPartOfSpeechLabel,
  getCategoryLabel,
  getValueLabel,
  formatGrammarBadge,
  getAllowedCategoryValues,
  getGrammarSummaryBadges,
  createDefaultGrammar,
  normalizeGrammarAnalysis,
} from "./translations";

export type { LabelPair, PartOfSpeech } from "./translations";
