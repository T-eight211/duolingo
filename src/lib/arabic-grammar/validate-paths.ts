/**
 * Interpreter for grammar-paths.json. Do not duplicate allowed combinations here.
 * This module intentionally accepts partial analyses: omitted fields do not fail
 * unless their presence itself contradicts another supplied field.
 */
import paths from "./grammar-paths.json";
import { grammarVocabulary as options } from "./grammar-options.generated";
import type { GrammarAnalysis, VerbAnalysis } from "./schema";

export type GrammarIssue = { path: Array<string | number>; message: string };
const verb = paths.parts_of_speech.verb;
const noun = paths.parts_of_speech.noun;
const particle = paths.parts_of_speech.particle;

type AgreementMap = Record<string, Record<string, Record<string, readonly string[]>>>;

type Persona = { person: 1 | 2 | 3; number: string; gender: string };

function checkAgreement(
  value: Partial<Persona>,
  agreement: Record<string, Record<string, readonly string[]>>,
  base: Array<string | number>, issues: GrammarIssue[],
) {
  if (value.person === undefined) return;
  const byNumber = agreement[String(value.person)];
  if (!byNumber) {
    issues.push({ path: [...base, "person"], message: "Person is invalid for this morphological pattern." });
    return;
  }
  if (value.number !== undefined && !Object.hasOwn(byNumber, value.number)) {
    issues.push({ path: [...base, "number"], message: "Number is invalid for this person and form." });
  }
  if (value.gender !== undefined) {
    const genders = value.number !== undefined
      ? (byNumber[value.number] ?? [])
      : Object.values(byNumber).flat();
    if (!genders.includes(value.gender)) issues.push({
      path: [...base, "gender"], message: "Gender is invalid for this person and number.",
    });
  }
}

function checkValue(
  actual: string | undefined,
  expected: readonly string[],
  field: Array<string | number>,
  issues: GrammarIssue[],
) {
  if (actual !== undefined && !expected.includes(actual)) {
    issues.push({ path: field, message: `Invalid value for selected grammar path: ${actual}.` });
  }
}

function matchesRequired(
  actual: unknown,
  required: unknown,
  path: Array<string | number>,
  issues: GrammarIssue[],
) {
  // Do not force model/user to invent a field that was not observed.
  if (actual !== undefined && actual !== required) {
    issues.push({ path, message: `Must be ${String(required)} in the selected grammatical construction.` });
  }
}

function checkSegments(
  analysis: GrammarAnalysis, issues: GrammarIssue[],
) {
  if (!analysis.segmentation) return;
  const eligible = paths.segmentation_rules;
  const host = analysis.part_of_speech;
  const hostMatches = (target: string) => target === host ||
    (host === "verb" && target === `verb:${analysis.aspect}`);
  for (const [index, prefix] of (analysis.segmentation.prefixes ?? []).entries()) {
    const hosts = (eligible.possible_prefix_types as Record<string, string[]>)[prefix.type] ?? [];
    if (!hosts.some(hostMatches)) issues.push({
      path: ["segmentation", "prefixes", index, "type"],
      message: `${prefix.type} cannot be used as a prefix for ${host}${host === "verb" ? `:${analysis.aspect}` : ""}.`,
    });
  }
  for (const [index, suffix] of (analysis.segmentation.suffixes ?? []).entries()) {
    const hosts = (eligible.possible_suffix_types as Record<string, string[]>)[suffix.type] ?? [];
    if (!hosts.some(hostMatches)) issues.push({
      path: ["segmentation", "suffixes", index, "type"],
      message: `${suffix.type} cannot be used as a suffix for ${host}${host === "verb" ? `:${analysis.aspect}` : ""}.`,
    });
  }
}

export function checkGrammarPaths(analysis: GrammarAnalysis): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  if (analysis.part_of_speech === "verb") {
    const aspect = analysis.aspect;
    const agreement = (verb.agreement_paths as AgreementMap)[aspect];
    checkAgreement(analysis, agreement, [], issues);
    checkValue(analysis.voice, verb.voice_by_aspect[aspect], ["voice"], issues);
    checkValue(analysis.mood, verb.mood_by_aspect[aspect], ["mood"], issues);
    checkValue(analysis.future_marker, verb.future_marker_by_aspect[aspect], ["future_marker"], issues);
    checkValue(analysis.energetic_nun, verb.energetic_nun_by_aspect[aspect], ["energetic_nun"], issues);
    checkValue(analysis.temporal_meaning, verb.temporal_meaning_by_aspect[aspect], ["temporal_meaning"], issues);

    if (analysis.future_marker !== undefined) {
      const rule = verb.future_marker_requirements;
      matchesRequired(aspect, rule.aspect, ["aspect"], issues);
      matchesRequired(analysis.mood, rule.mood, ["mood"], issues);
      matchesRequired(analysis.temporal_meaning, rule.temporal_meaning, ["temporal_meaning"], issues);
    }

    if (analysis.negation !== undefined) {
      if (aspect === "imperative" && verb.negation.imperative_forbidden) {
        issues.push({ path: ["negation"], message: "A morphological imperative cannot have a negation/prohibition construction; use an imperfect jussive for لا الناهية." });
      }
      if (analysis.negation.type === "prohibition") {
        const required = verb.negation.prohibition;
        matchesRequired(aspect, required.aspect, ["aspect"], issues);
        matchesRequired(analysis.mood, required.mood, ["mood"], issues);
        matchesRequired(analysis.negation.particle, required.particle, ["negation", "particle"], issues);
      }
      const particleRules = verb.negation.particle_requirements as Record<string, { aspect: string; mood: string; type: string; temporal_meaning?: string }>;
      const r = particleRules[analysis.negation.particle];
      if (r) {
        matchesRequired(aspect, r.aspect, ["aspect"], issues);
        matchesRequired(analysis.mood, r.mood, ["mood"], issues);
        matchesRequired(analysis.negation.type, r.type, ["negation", "type"], issues);
        matchesRequired(analysis.temporal_meaning, r.temporal_meaning, ["temporal_meaning"], issues);
      }
      if (analysis.negation.particle === "لا" && analysis.negation.type === "normal_negation" && aspect === "imperfect") {
        matchesRequired(analysis.mood, verb.negation.ordinary_la.mood, ["mood"], issues);
      }
    }

    const attached = verb.attached_pronouns.role_paths as AgreementMap;
    for (const [index, clitic] of (analysis.attached_pronouns ?? []).entries()) {
      checkAgreement(clitic, attached[clitic.role], ["attached_pronouns", index], issues);
    }
  }

  if (analysis.part_of_speech === "noun") {
    if (analysis.plural_type !== undefined && analysis.number !== undefined && analysis.number !== noun.plural_type_only_number) {
      issues.push({ path: ["plural_type"], message: "Plural type must be omitted unless the noun is plural." });
    }
    const subtypeRequirements = noun.subtype_requires as Record<string, Record<string, string>>;
    const sourceRequirements = noun.source_requires as Record<string, Record<string, string>>;
    for (const [key, val] of Object.entries(subtypeRequirements[analysis.subtype] ?? {})) {
      matchesRequired(analysis[key as keyof typeof analysis], val, [key], issues);
    }
    if (analysis.definiteness_source !== undefined) {
      for (const [key, val] of Object.entries(sourceRequirements[analysis.definiteness_source] ?? {})) {
        matchesRequired(analysis[key as keyof typeof analysis], val, [key], issues);
      }
    }
    if (analysis.definiteness === "construct") {
      matchesRequired(analysis.idafa_role, noun.construct_requires.idafa_role, ["idafa_role"], issues);
    }
    if (analysis.possessor !== undefined) {
      checkAgreement(analysis.possessor, noun.possessor_agreement_paths, ["possessor"], issues);
    }
  }

  if (analysis.part_of_speech === "particle") {
    const effectMap = particle.allowed_effects_by_subtype as Record<string, readonly string[]>;
    const permitted = effectMap[analysis.subtype] ?? [];
    for (const [index, effect] of (analysis.grammatical_effect ?? []).entries()) {
      checkValue(effect, permitted, ["grammatical_effect", index], issues);
      if (analysis.grammatical_effect?.indexOf(effect) !== index) {
        issues.push({ path: ["grammatical_effect", index], message: "Duplicate grammatical effect." });
      }
    }
  }

  checkSegments(analysis, issues);
  return issues;
}

/** Same path data controls the editor and the validator. */
export function getAllowedVerbChoices(selection: Pick<VerbAnalysis, "aspect"> & Partial<Pick<VerbAnalysis, "person" | "number">>) {
  const agreement = (verb.agreement_paths as AgreementMap)[selection.aspect];
  const persons = Object.keys(agreement).map(Number) as Array<1 | 2 | 3>;
  const byNumber = selection.person !== undefined ? agreement[String(selection.person)] : undefined;
  const numbers = byNumber ? Object.keys(byNumber) : [];
  const genders = byNumber
    ? selection.number ? (byNumber[selection.number] ?? []) : [...new Set(Object.values(byNumber).flat())]
    : [];
  return {
    person: persons,
    number: numbers,
    gender: genders,
    voice: verb.voice_by_aspect[selection.aspect],
    mood: verb.mood_by_aspect[selection.aspect],
    future_marker: verb.future_marker_by_aspect[selection.aspect],
    energetic_nun: verb.energetic_nun_by_aspect[selection.aspect],
  };
}

export function getAllowedNounPluralTypes(number: string | undefined) {
  return number === noun.plural_type_only_number
    ? options.parts_of_speech.noun.plural_type : [];
}

export function getAllowedParticleEffects(subtype: string) {
  return (particle.allowed_effects_by_subtype as Record<string, readonly string[]>)[subtype] ?? [];
}
