import labelsData from "./grammar-labels.json";
import optionsData from "./grammar-options.json";
import type {
  GrammarAnalysis,
  NounAnalysis,
  VerbAnalysis,
  ParticleAnalysis,
} from "./schema";

const g = optionsData.arabic_grammar;
const t = labelsData.arabic_grammar;

export type LabelPair = {
  english: string;
  arabic: string;
};

export type PartOfSpeech = "noun" | "verb" | "particle";

export function getPartOfSpeechLabel(pos: PartOfSpeech): LabelPair {
  const p = t.parts_of_speech[pos]?.label;
  if (!p) return { english: pos, arabic: pos };
  return {
    english: p.english.split("/")[0].trim(),
    arabic: p.arabic,
  };
}

export function getCategoryLabel(
  pos: PartOfSpeech,
  category: string,
): LabelPair {
  const cat = (t.parts_of_speech[pos] as Record<string, any>)?.[category];
  if (cat?.label) {
    return {
      english: cat.label.english,
      arabic: cat.label.arabic,
    };
  }
  return {
    english: category.replace(/_/g, " "),
    arabic: category,
  };
}

export function getValueLabel(
  pos: PartOfSpeech,
  category: string,
  value: string | number | null | undefined,
): LabelPair {
  if (value === null || value === undefined) {
    return { english: "Not Specified", arabic: "غير محدد" };
  }
  const strVal = String(value);
  const cat = (t.parts_of_speech[pos] as Record<string, any>)?.[category];
  const val = cat?.values?.[strVal];
  if (val) {
    return {
      english: val.english,
      arabic: val.arabic,
    };
  }
  // Check pronoun features
  if (category === "person" || category === "gender" || category === "number") {
    const pf = (t.pronoun_features as Record<string, any>)?.[category]?.values?.[strVal];
    if (pf) {
      return { english: pf.english, arabic: pf.arabic };
    }
  }
  return {
    english: strVal.replace(/_/g, " "),
    arabic: strVal,
  };
}

export function formatGrammarBadge(pair: LabelPair): string {
  return `${pair.arabic} · ${pair.english}`;
}

export function getAllowedCategoryValues(
  pos: PartOfSpeech,
  category: string,
): Array<{ value: string | number; english: string; arabic: string }> {
  const allowed = (g.parts_of_speech[pos] as Record<string, any>)?.[category];
  if (!Array.isArray(allowed)) return [];
  return allowed.map((val) => {
    const label = getValueLabel(pos, category, val);
    return {
      value: val,
      english: label.english,
      arabic: label.arabic,
    };
  });
}

function attachLegacyAliases(obj: any, pos: PartOfSpeech): any {
  if (pos === "noun") {
    Object.defineProperty(obj, "noun", {
      get() {
        return this;
      },
      enumerable: false,
      configurable: true,
    });
  } else if (pos === "verb") {
    Object.defineProperty(obj, "verb", {
      get() {
        return this;
      },
      enumerable: false,
      configurable: true,
    });
  } else if (pos === "particle") {
    Object.defineProperty(obj, "particle", {
      get() {
        return this;
      },
      enumerable: false,
      configurable: true,
    });
  }
  return obj;
}

/**
 * Normalizes any legacy nested grammar objects (e.g. { part_of_speech: "noun", noun: {...} })
 * into the canonical flat discriminated union format, stripping legacy "none" strings,
 * null values, and cross-POS fields that do not belong to the selected part of speech.
 */
export function normalizeGrammarAnalysis(raw: any): GrammarAnalysis {
  if (!raw || typeof raw !== "object" || !raw.part_of_speech) {
    return attachLegacyAliases(createDefaultGrammar("noun"), "noun");
  }
  const pos: PartOfSpeech = raw.part_of_speech;

  const NOUN_FIELDS = new Set([
    "part_of_speech",
    "subtype",
    "gender",
    "number",
    "plural_type",
    "case",
    "definiteness",
    "definiteness_source",
    "idafa_role",
    "rationality",
    "derivation",
    "possessor",
    "segmentation",
  ]);

  const VERB_FIELDS = new Set([
    "part_of_speech",
    "aspect",
    "temporal_meaning",
    "future_marker",
    "person",
    "gender",
    "number",
    "mood",
    "energetic_nun",
    "voice",
    "verb_form",
    "negation",
    "attached_pronouns",
    "weakness",
    "transitivity",
    "segmentation",
  ]);

  const PARTICLE_FIELDS = new Set([
    "part_of_speech",
    "subtype",
    "grammatical_effect",
    "segmentation",
  ]);

  const allowedFields =
    pos === "verb"
      ? VERB_FIELDS
      : pos === "particle"
        ? PARTICLE_FIELDS
        : NOUN_FIELDS;

  // Flatten nested legacy or process existing flat object
  let source = { ...raw };
  if (pos === "noun" && raw.noun) {
    source = { part_of_speech: "noun", ...raw.noun };
  } else if (pos === "verb" && raw.verb) {
    source = { part_of_speech: "verb", ...raw.verb };
  } else if (pos === "particle" && raw.particle) {
    source = { part_of_speech: "particle", ...raw.particle };
  }

  const cleaned: Record<string, any> = { part_of_speech: pos };
  for (const [k, v] of Object.entries(source)) {
    if (
      !allowedFields.has(k) ||
      v === null ||
      v === undefined ||
      v === "" ||
      v === "null" ||
      v === "none" ||
      v === "not_applicable" ||
      k === "notes"
    ) {
      continue;
    }
    cleaned[k] = v;
  }

  // POS-specific cleanups
  if (pos === "verb") {
    if (cleaned.aspect === "imperative") {
      delete cleaned.mood;
      delete cleaned.future_marker;
      delete cleaned.negation;
    }
    if (cleaned.aspect === "perfect") {
      delete cleaned.mood;
      delete cleaned.future_marker;
    }
    // Person/gender agreement defaults
    if (cleaned.person === 1 || (cleaned.person === 2 && cleaned.number === "dual")) {
      cleaned.gender = "not_distinguished";
    }
    // Verbs only accept masculine, feminine, or not_distinguished (not "unknown")
    if (cleaned.gender === "unknown") {
      delete cleaned.gender;
    }
  } else if (pos === "noun") {
    if (cleaned.number !== "plural") {
      delete cleaned.plural_type;
    }
    // Nouns do not use "not_distinguished"
    if (cleaned.gender === "not_distinguished") {
      cleaned.gender = "unknown";
    }
  }

  return attachLegacyAliases(cleaned, pos) as GrammarAnalysis;
}

export function getGrammarSummaryBadges(
  rawGrammar: any,
): Array<{ id: string; arabic: string; english: string; label: string }> {
  if (!rawGrammar || !rawGrammar.part_of_speech) return [];
  const grammar = normalizeGrammarAnalysis(rawGrammar);
  const badges: Array<{ id: string; arabic: string; english: string; label: string }> = [];

  const pos = grammar.part_of_speech;
  const posLabel = getPartOfSpeechLabel(pos);
  badges.push({
    id: "pos",
    arabic: posLabel.arabic,
    english: posLabel.english,
    label: `${posLabel.arabic} · ${posLabel.english}`,
  });

  if (pos === "noun") {
    const n = grammar as NounAnalysis;
    if (n.subtype && n.subtype !== "common_noun") {
      const l = getValueLabel("noun", "subtypes", n.subtype);
      badges.push({ id: "subtype", ...l, label: formatGrammarBadge(l) });
    }
    if (n.gender && n.gender !== "unknown") {
      const l = getValueLabel("noun", "gender", n.gender);
      badges.push({ id: "gender", ...l, label: formatGrammarBadge(l) });
    }
    if (n.number && n.number !== "unknown") {
      const l = getValueLabel("noun", "number", n.number);
      badges.push({ id: "number", ...l, label: formatGrammarBadge(l) });
    }
    if (n.definiteness && n.definiteness !== "unknown") {
      const l = getValueLabel("noun", "definiteness", n.definiteness);
      badges.push({ id: "definiteness", ...l, label: formatGrammarBadge(l) });
    }
    if (n.case && n.case !== "unknown") {
      const l = getValueLabel("noun", "case", n.case);
      badges.push({ id: "case", ...l, label: formatGrammarBadge(l) });
    }
  } else if (pos === "verb") {
    const v = grammar as VerbAnalysis;
    if (v.aspect) {
      const l = getValueLabel("verb", "aspect", v.aspect);
      badges.push({ id: "aspect", ...l, label: formatGrammarBadge(l) });
    }
    if (v.person) {
      const l = getValueLabel("verb", "person", v.person);
      badges.push({ id: "person", ...l, label: formatGrammarBadge(l) });
    }
    if (v.gender && v.gender !== "not_distinguished") {
      const l = getValueLabel("verb", "gender", v.gender);
      badges.push({ id: "gender", ...l, label: formatGrammarBadge(l) });
    }
    if (v.number) {
      const l = getValueLabel("verb", "number", v.number);
      badges.push({ id: "number", ...l, label: formatGrammarBadge(l) });
    }
    if (v.mood && v.mood !== "unknown") {
      const l = getValueLabel("verb", "mood", v.mood);
      badges.push({ id: "mood", ...l, label: formatGrammarBadge(l) });
    }
    if (v.voice && v.voice !== "unknown") {
      const l = getValueLabel("verb", "voice", v.voice);
      badges.push({ id: "voice", ...l, label: formatGrammarBadge(l) });
    }
  } else if (pos === "particle") {
    const p = grammar as ParticleAnalysis;
    if (p.subtype) {
      const l = getValueLabel("particle", "subtypes", p.subtype);
      badges.push({ id: "subtype", ...l, label: formatGrammarBadge(l) });
    }
    if (p.grammatical_effect && p.grammatical_effect.length > 0) {
      for (const eff of p.grammatical_effect) {
        const l = getValueLabel("particle", "grammatical_effect", eff);
        badges.push({ id: `effect-${eff}`, ...l, label: formatGrammarBadge(l) });
      }
    }
  }

  return badges;
}

export function createDefaultGrammar(pos: PartOfSpeech): GrammarAnalysis {
  switch (pos) {
    case "noun":
      return {
        part_of_speech: "noun",
        subtype: "common_noun",
        gender: "masculine",
        number: "singular",
      };
    case "verb":
      return {
        part_of_speech: "verb",
        aspect: "perfect",
        person: 3,
        gender: "masculine",
        number: "singular",
        voice: "active",
      };
    case "particle":
      return {
        part_of_speech: "particle",
        subtype: "preposition",
      };
  }
}
