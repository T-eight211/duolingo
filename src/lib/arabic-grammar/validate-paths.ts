/**
 * Interpreter for grammar-paths.json. Do not duplicate allowed combinations here.
 * This module intentionally accepts partial analyses: omitted fields do not fail
 * unless their presence itself contradicts another supplied field.
 */
import paths from "./grammar-paths.json";
import { grammarVocabulary as options } from "./grammar-options.generated";
import type { GrammarAnalysis, VerbAnalysis, NounAnalysis } from "./schema";

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
    if (aspect) {
      const agreement = (verb.agreement_paths as AgreementMap)[aspect];
      if (agreement) {
        checkAgreement(analysis, agreement, [], issues);
      }
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
  }

  if (analysis.part_of_speech === "noun") {
    if (analysis.plural_type !== undefined && analysis.number !== undefined && analysis.number !== noun.plural_type_only_number) {
      issues.push({ path: ["plural_type"], message: "Plural type must be omitted unless the noun is plural." });
    }
    const subtypeRequirements = noun.subtype_requires as Record<string, Record<string, string>>;
    const sourceRequirements = noun.source_requires as Record<string, Record<string, string>>;
    if (analysis.subtype) {
      for (const [key, val] of Object.entries(subtypeRequirements[analysis.subtype] ?? {})) {
        matchesRequired(analysis[key as keyof typeof analysis], val, [key], issues);
      }
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
    if (analysis.subtype) {
      const permitted = effectMap[analysis.subtype] ?? [];
      for (const [index, effect] of (analysis.grammatical_effect ?? []).entries()) {
        checkValue(effect, permitted, ["grammatical_effect", index], issues);
        if (analysis.grammatical_effect?.indexOf(effect) !== index) {
          issues.push({ path: ["grammatical_effect", index], message: "Duplicate grammatical effect." });
        }
      }
    }
  }

  checkSegments(analysis, issues);
  return issues;
}

/** Same path data controls the editor and the validator. */
export function getAllowedVerbChoices(
  selection?: Partial<Pick<VerbAnalysis, "aspect" | "person" | "number">>,
) {
  if (!selection?.aspect) {
    return {
      person: [1, 2, 3] as Array<1 | 2 | 3>,
      number: ["singular", "dual", "plural"],
      gender: ["masculine", "feminine", "not_distinguished"],
      voice: options.parts_of_speech.verb.voice,
      mood: [] as readonly string[],
      future_marker: [] as readonly string[],
      energetic_nun: [] as readonly string[],
    };
  }
  const agreement = (verb.agreement_paths as AgreementMap)[selection.aspect];
  if (!agreement) {
    return {
      person: [1, 2, 3] as Array<1 | 2 | 3>,
      number: ["singular", "dual", "plural"],
      gender: ["masculine", "feminine", "not_distinguished"],
      voice: options.parts_of_speech.verb.voice,
      mood: [] as readonly string[],
      future_marker: [] as readonly string[],
      energetic_nun: [] as readonly string[],
    };
  }
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
    voice: verb.voice_by_aspect[selection.aspect] ?? options.parts_of_speech.verb.voice,
    mood: verb.mood_by_aspect[selection.aspect] ?? [],
    future_marker: verb.future_marker_by_aspect[selection.aspect] ?? [],
    energetic_nun: verb.energetic_nun_by_aspect[selection.aspect] ?? [],
  };
}

export function getAllowedNounChoices(
  selection?: Partial<Omit<NounAnalysis, "possessor">> & {
    possessor?: Partial<NonNullable<NounAnalysis["possessor"]>>;
  },
) {
  const subtypeRequirements = noun.subtype_requires as Record<
    string,
    Record<string, string>
  >;

  // 1. Definiteness allowed choices (constrained by subtype, NOT by child definiteness_source)
  let allowedDefiniteness: readonly string[] =
    options.parts_of_speech.noun.definiteness;
  if (
    selection?.subtype &&
    subtypeRequirements[selection.subtype]?.definiteness
  ) {
    allowedDefiniteness = [subtypeRequirements[selection.subtype].definiteness];
  }

  // 2. Subtypes allowed choices
  let allowedSubtypes: readonly string[] =
    options.parts_of_speech.noun.subtypes;
  if (selection?.definiteness && selection.definiteness !== "definite") {
    // Exclude subtypes that strictly require definite
    allowedSubtypes = allowedSubtypes.filter(
      (st) => subtypeRequirements[st]?.definiteness !== "definite",
    );
  }
  if (selection?.derivation) {
    allowedSubtypes = allowedSubtypes.filter((st) => {
      const reqDeriv = subtypeRequirements[st]?.derivation;
      return !reqDeriv || reqDeriv === selection.derivation;
    });
  }

  // 3. Definiteness Source allowed choices (child of definiteness)
  let allowedSources: readonly string[] = [];
  const isDefinite =
    selection?.definiteness === "definite" ||
    (!selection?.definiteness &&
      allowedDefiniteness.length === 1 &&
      allowedDefiniteness[0] === "definite");

  if (isDefinite) {
    if (selection?.subtype === "pronoun") {
      allowedSources = ["pronoun"];
    } else if (selection?.subtype === "demonstrative") {
      allowedSources = ["demonstrative"];
    } else if (selection?.subtype === "proper_noun") {
      allowedSources = ["proper_noun"];
    } else if (selection?.subtype === "relative_pronoun") {
      allowedSources = [];
    } else if (selection?.subtype !== undefined) {
      // For common noun, adjective, participle, etc.
      allowedSources = ["al", "possessive_pronoun"];
      if (selection?.idafa_role && selection.idafa_role !== "mudaf") {
        allowedSources = allowedSources.filter((s) => s !== "possessive_pronoun");
      }
    } else if (selection?.definiteness === "definite") {
      allowedSources = ["al", "possessive_pronoun", "proper_noun", "pronoun", "demonstrative"];
    }
  }

  // 4. Derivation allowed choices
  let allowedDerivation: readonly string[] = [];
  const nonDerivedSubtypes = [
    "proper_noun",
    "pronoun",
    "demonstrative",
    "relative_pronoun",
    "numeral",
  ];
  if (!selection?.subtype || !nonDerivedSubtypes.includes(selection.subtype)) {
    if (
      selection?.subtype &&
      subtypeRequirements[selection.subtype]?.derivation
    ) {
      allowedDerivation = [subtypeRequirements[selection.subtype].derivation];
    } else {
      allowedDerivation = options.parts_of_speech.noun.derivation;
    }
  }

  // 5. Idafa Role allowed choices
  let allowedIdafaRole: readonly string[] = [];
  if (
    selection?.definiteness === "construct" ||
    selection?.definiteness_source === "possessive_pronoun"
  ) {
    allowedIdafaRole = ["mudaf"];
  }

  // 6. Plural Type
  const allowedPluralType: readonly string[] = getAllowedNounPluralTypes(selection?.number);

  // 7. Possessor agreement choices
  let possessorChoices = {
    person: [1, 2, 3] as Array<1 | 2 | 3>,
    number: ["singular", "dual", "plural"] as string[],
    gender: ["masculine", "feminine", "not_distinguished"] as string[],
  };
  const possessorAgreements = noun.possessor_agreement_paths as Record<
    string,
    Record<string, string[]>
  >;
  if (selection?.possessor?.person) {
    const byNumber = possessorAgreements[String(selection.possessor.person)];
    if (byNumber) {
      const numbers = Object.keys(byNumber);
      const genders = selection.possessor.number
        ? (byNumber[selection.possessor.number] ?? [])
        : [...new Set(Object.values(byNumber).flat())];
      possessorChoices = {
        person: [1, 2, 3],
        number: numbers,
        gender: genders,
      };
    }
  }

  return {
    subtypes: allowedSubtypes,
    gender: options.parts_of_speech.noun.gender as readonly string[],
    number: options.parts_of_speech.noun.number as readonly string[],
    case: options.parts_of_speech.noun.case as readonly string[],
    definiteness: allowedDefiniteness,
    definiteness_source: allowedSources,
    idafa_role: allowedIdafaRole,
    rationality: options.parts_of_speech.noun.rationality as readonly string[],
    derivation: allowedDerivation,
    plural_type: allowedPluralType,
    possessor: possessorChoices,
  };
}

export function getAllowedNounPluralTypes(
  number: string | undefined,
): readonly string[] {
  return number === noun.plural_type_only_number
    ? options.parts_of_speech.noun.plural_type
    : [];
}

export function getAllowedParticleEffects(subtype?: string) {
  if (!subtype) return [];
  return (particle.allowed_effects_by_subtype as Record<string, readonly string[]>)[subtype] ?? [];
}
