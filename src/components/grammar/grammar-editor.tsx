"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  AlertCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  checkGrammarPaths,
  getAllowedVerbChoices,
  getAllowedNounPluralTypes,
  getAllowedParticleEffects,
  getCategoryLabel,
  getPartOfSpeechLabel,
  getAllowedCategoryValues,
  createDefaultGrammar,
  normalizeGrammarAnalysis,
  type GrammarAnalysis,
  type NounAnalysis,
  type VerbAnalysis,
  type ParticleAnalysis,
  type PartOfSpeech,
} from "@/lib/arabic-grammar";

interface GrammarSelectFieldProps {
  label: { arabic: string; english: string };
  currentValue: string | number | null | undefined;
  options: Array<{ value: string | number; arabic: string; english: string }>;
  onValueChange: (val: any) => void;
  isNumeric?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function GrammarSelectField({
  label,
  currentValue,
  options,
  onValueChange,
  isNumeric = false,
  disabled = false,
  placeholder,
}: GrammarSelectFieldProps) {
  const hasValue =
    currentValue !== null && currentValue !== undefined && currentValue !== "";
  const stringValue = hasValue ? String(currentValue) : "";

  const defaultPlaceholder = `Select ${label.english.toLowerCase()}`;
  const displayPlaceholder = placeholder || defaultPlaceholder;

  return (
    <div
      className={cn(
        "group relative flex flex-wrap items-center justify-between gap-2 py-1.5 ps-4 text-xs transition-colors hover:bg-slate-50/70 rounded-lg",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {/* Tree connector branch */}
      <span
        className="absolute -left-0.5 top-1/2 h-px w-3.5 bg-slate-300"
        aria-hidden="true"
      />

      {/* Category Label (Arabic & English) */}
      <div className="flex items-center gap-1.5 font-medium text-slate-600">
        <span dir="rtl" lang="ar" className="font-arabic font-bold text-slate-800">
          {label.arabic}
        </span>
        <span className="text-slate-300">-</span>
        <span dir="ltr" className="text-slate-500">
          {label.english}
        </span>
      </div>

      {/* Select Field with clean trigger and integrated clear button */}
      <div className="relative shrink-0 flex items-center">
        <Select
          value={stringValue}
          onValueChange={(val) => {
            if (!val) {
              onValueChange(undefined);
            } else if (isNumeric) {
              onValueChange(Number(val));
            } else {
              onValueChange(val);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              "w-[240px] sm:w-[260px] h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-2xs hover:bg-slate-50 focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
              hasValue && "[&_svg]:hidden pr-8",
            )}
          >
            <SelectValue placeholder={displayPlaceholder} />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="w-[240px] sm:w-[260px] max-h-60"
          >
            {options.map((opt) => (
              <SelectItem
                key={String(opt.value)}
                value={String(opt.value)}
                className="text-xs font-medium cursor-pointer"
              >
                <div className="flex items-center gap-1.5 w-full truncate">
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic font-bold text-neutral-800 shrink-0"
                  >
                    {opt.arabic}
                  </span>
                  <span className="text-slate-300 shrink-0">-</span>
                  <span dir="ltr" className="text-slate-600 truncate">
                    {opt.english}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear icon inside the field on the right when a value is selected, replaces chevron space smoothly */}
        {hasValue && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onValueChange(undefined);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface GrammarEditorProps {
  grammar?: GrammarAnalysis | null;
  wordText?: string;
  englishText?: string;
  onChange: (updated: GrammarAnalysis) => void;
  className?: string;
}

export function GrammarEditor({
  grammar: initialGrammar,
  wordText,
  englishText,
  onChange,
  className,
}: GrammarEditorProps) {
  const grammar = useMemo(
    () => normalizeGrammarAnalysis(initialGrammar),
    [initialGrammar],
  );
  const pos = grammar.part_of_speech;

  // Validation issues according to path rules
  const issues = useMemo(() => checkGrammarPaths(grammar), [grammar]);

  // Collapsible sections state
  const [showPossessor, setShowPossessor] = useState(
    pos === "noun" && !!(grammar as NounAnalysis).possessor?.person,
  );
  const [showVerbNegation, setShowVerbNegation] = useState(
    pos === "verb" && !!(grammar as VerbAnalysis).negation?.particle,
  );
  const [showAttachedPronoun, setShowAttachedPronoun] = useState(
    pos === "verb" && !!(grammar as VerbAnalysis).attached_pronouns?.length,
  );

  function handlePosChange(newPos: PartOfSpeech) {
    if (newPos === pos) return;
    const next = createDefaultGrammar(newPos);
    onChange(next);
  }

  function updateField(field: string, value: any) {
    const next = { ...grammar };
    if (value === undefined || value === null || value === "") {
      delete (next as any)[field];
    } else {
      (next as any)[field] = value;
    }

    // Path constraints: clear dependent child fields if parent changed
    if (next.part_of_speech === "verb") {
      const verbAnalysis = next as VerbAnalysis;
      if (field === "aspect") {
        const choices = getAllowedVerbChoices({ aspect: verbAnalysis.aspect });
        if (verbAnalysis.person && !choices.person.includes(verbAnalysis.person)) {
          delete (next as any).person;
        }
        if (verbAnalysis.voice && !(choices.voice as readonly string[]).includes(verbAnalysis.voice)) {
          delete (next as any).voice;
        }
        if (verbAnalysis.mood && !(choices.mood as readonly string[]).includes(verbAnalysis.mood)) {
          delete (next as any).mood;
        }
        if (
          verbAnalysis.future_marker &&
          !(choices.future_marker as readonly string[]).includes(verbAnalysis.future_marker)
        ) {
          delete (next as any).future_marker;
        }
        if (verbAnalysis.aspect === "imperative") {
          delete (next as any).negation;
          setShowVerbNegation(false);
        }
      }
      if (field === "person" || field === "number") {
        const choices = getAllowedVerbChoices({
          aspect: verbAnalysis.aspect,
          person: verbAnalysis.person,
          number: verbAnalysis.number,
        });
        if (verbAnalysis.gender && !choices.gender.includes(verbAnalysis.gender)) {
          delete (next as any).gender;
        }
      }
    } else if (next.part_of_speech === "noun") {
      const nounAnalysis = next as NounAnalysis;
      if (field === "number" && nounAnalysis.number !== "plural") {
        delete (next as any).plural_type;
      }
    } else if (next.part_of_speech === "particle") {
      const particleAnalysis = next as ParticleAnalysis;
      if (field === "subtype") {
        const allowed = getAllowedParticleEffects(particleAnalysis.subtype);
        if (particleAnalysis.grammatical_effect) {
          const filtered = particleAnalysis.grammatical_effect.filter((e) =>
            allowed.includes(e),
          );
          if (filtered.length > 0) {
            (next as any).grammatical_effect = filtered;
          } else {
            delete (next as any).grammatical_effect;
          }
        }
      }
    }

    onChange(next as GrammarAnalysis);
  }

  function renderCategoryBranch(
    categoryKey: string,
    currentValue: string | number | null | undefined,
    allowedValuesFilter?: readonly (string | number)[],
  ) {
    const catLabel = getCategoryLabel(pos, categoryKey);
    let options = getAllowedCategoryValues(pos, categoryKey);

    if (allowedValuesFilter) {
      options = options.filter((opt) =>
        allowedValuesFilter.includes(opt.value),
      );
    }

    return (
      <GrammarSelectField
        key={categoryKey}
        label={catLabel}
        currentValue={currentValue}
        options={options}
        isNumeric={categoryKey === "person"}
        onValueChange={(val) => updateField(categoryKey, val)}
      />
    );
  }

  // Pre-calculate verb choices for dynamic filtering
  const verbChoices = useMemo(() => {
    if (pos !== "verb") return null;
    const v = grammar as VerbAnalysis;
    return getAllowedVerbChoices({
      aspect: v.aspect,
      person: v.person,
      number: v.number,
    });
  }, [pos, grammar]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4 text-start font-sans text-xs sm:p-5",
        className,
      )}
    >
      {/* Root Node Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-sky-500 shrink-0" />
          <div className="flex items-center gap-2 font-bold text-neutral-800 text-sm">
            {wordText && (
              <span dir="rtl" lang="ar" className="font-arabic text-base text-neutral-900">
                {wordText}
              </span>
            )}
            {wordText && englishText && <span className="text-slate-300">-</span>}
            {englishText && <span className="text-slate-600">{englishText}</span>}
          </div>
        </div>

        {/* Part of Speech Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          {(["noun", "verb", "particle"] as const).map((p) => {
            const isSelected = pos === p;
            const l = getPartOfSpeechLabel(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePosChange(p)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition",
                  isSelected
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <span dir="rtl" lang="ar" className="font-arabic">
                  {l.arabic}
                </span>
                <span className="text-[10px] opacity-75">· {l.english}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Path Validation Issues Banner (if any) */}
      {issues.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">Grammar combination note:</span>
            {issues.map((iss, i) => (
              <span key={i} className="text-amber-700">
                • {iss.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hierarchical Tree Container */}
      <div className="relative flex flex-col gap-1 border-s-2 border-slate-200 ps-2 ms-2">
        {/* Noun Characteristics */}
        {pos === "noun" && (() => {
          const n = grammar as NounAnalysis;
          const allowedPlural = getAllowedNounPluralTypes(n.number);

          return (
            <>
              {renderCategoryBranch("subtypes", n.subtype)}
              {renderCategoryBranch("gender", n.gender)}
              {renderCategoryBranch("number", n.number)}
              {n.number === "plural" &&
                renderCategoryBranch("plural_type", n.plural_type, allowedPlural)}
              {renderCategoryBranch("case", n.case)}
              {renderCategoryBranch("definiteness", n.definiteness)}
              {renderCategoryBranch("definiteness_source", n.definiteness_source)}
              {renderCategoryBranch("idafa_role", n.idafa_role)}
              {renderCategoryBranch("rationality", n.rationality)}
              {renderCategoryBranch("derivation", n.derivation)}

              {/* Nested Possessor Tree Branch */}
              <div className="relative mt-1 ps-4">
                <span
                  className="absolute -left-0.5 top-4 h-px w-3.5 bg-slate-300"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !showPossessor;
                    setShowPossessor(nextState);
                    if (!nextState) {
                      updateField("possessor", undefined);
                    } else if (!n.possessor) {
                      updateField("possessor", {
                        person: 3,
                        gender: "masculine",
                        number: "singular",
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg py-1 font-bold text-slate-700 hover:text-sky-600 transition"
                >
                  {showPossessor ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span dir="rtl" lang="ar" className="font-arabic">
                    ضمير الملكية المتصل
                  </span>
                  <span className="text-slate-300">-</span>
                  <span>Attached Possessive Pronoun</span>
                  <Badge
                    variant={showPossessor ? "secondary" : "outline"}
                    className="ms-2 px-1.5 py-0 text-[10px]"
                  >
                    {showPossessor ? "Active" : "None"}
                  </Badge>
                </button>

                {showPossessor && (
                  <div className="relative mt-1 flex flex-col gap-1 border-s-2 border-slate-200 ps-2 ms-2">
                    <GrammarSelectField
                      label={{ arabic: "الشخص", english: "Person" }}
                      currentValue={n.possessor?.person ?? 3}
                      isNumeric
                      options={[
                        { value: 1, arabic: "المتكلم", english: "1st Person" },
                        { value: 2, arabic: "المخاطب", english: "2nd Person" },
                        { value: 3, arabic: "الغائب", english: "3rd Person" },
                      ]}
                      onValueChange={(val) =>
                        updateField("possessor", {
                          ...(n.possessor || { gender: "masculine", number: "singular" }),
                          person: val as 1 | 2 | 3,
                        })
                      }
                    />

                    <GrammarSelectField
                      label={{ arabic: "الجنس", english: "Gender" }}
                      currentValue={n.possessor?.gender ?? "masculine"}
                      options={[
                        { value: "masculine", arabic: "مذكر", english: "Masculine" },
                        { value: "feminine", arabic: "مؤنث", english: "Feminine" },
                        { value: "not_distinguished", arabic: "غير مميز", english: "Not Distinguished" },
                      ]}
                      onValueChange={(val) =>
                        updateField("possessor", {
                          ...(n.possessor || { person: 3, number: "singular" }),
                          gender: val,
                        })
                      }
                    />

                    <GrammarSelectField
                      label={{ arabic: "العدد", english: "Number" }}
                      currentValue={n.possessor?.number ?? "singular"}
                      options={[
                        { value: "singular", arabic: "مفرد", english: "Singular" },
                        { value: "dual", arabic: "مثنى", english: "Dual" },
                        { value: "plural", arabic: "جمع", english: "Plural" },
                      ]}
                      onValueChange={(val) =>
                        updateField("possessor", {
                          ...(n.possessor || { person: 3, gender: "masculine" }),
                          number: val,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Verb Characteristics */}
        {pos === "verb" && (() => {
          const v = grammar as VerbAnalysis;
          const choices = verbChoices;

          return (
            <>
              {renderCategoryBranch("aspect", v.aspect)}
              {renderCategoryBranch("person", v.person, choices?.person)}
              {renderCategoryBranch("number", v.number, choices?.number)}
              {renderCategoryBranch("gender", v.gender, choices?.gender)}
              {renderCategoryBranch("voice", v.voice, choices?.voice)}

              {/* Mood applies only when allowed (imperfect) */}
              {choices && choices.mood.length > 0 &&
                renderCategoryBranch("mood", v.mood, choices.mood)}

              {/* Future marker applies only when allowed (imperfect) */}
              {choices && choices.future_marker.length > 0 &&
                renderCategoryBranch("future_marker", v.future_marker, choices.future_marker)}

              {/* Energetic nun */}
              {choices && choices.energetic_nun.length > 0 &&
                renderCategoryBranch("energetic_nun", v.energetic_nun, choices.energetic_nun)}

              {renderCategoryBranch("temporal_meaning", v.temporal_meaning)}
              {renderCategoryBranch("verb_form", v.verb_form)}
              {renderCategoryBranch("transitivity", v.transitivity)}
              {renderCategoryBranch("weakness", v.weakness)}

              {/* Verb Negation Branch (Only for non-imperatives) */}
              {v.aspect !== "imperative" && (
                <div className="relative mt-1 ps-4">
                  <span className="absolute -left-0.5 top-4 h-px w-3.5 bg-slate-300" />
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !showVerbNegation;
                      setShowVerbNegation(nextState);
                      if (!nextState) {
                        updateField("negation", undefined);
                      } else if (!v.negation) {
                        updateField("negation", {
                          particle: "لا",
                          type: "normal_negation",
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-lg py-1 font-bold text-slate-700 hover:text-sky-600 transition"
                  >
                    {showVerbNegation ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span dir="rtl" lang="ar" className="font-arabic">
                      النفي والنهي
                    </span>
                    <span className="text-slate-300">-</span>
                    <span>Negation / Prohibition</span>
                    <Badge
                      variant={showVerbNegation ? "secondary" : "outline"}
                      className="ms-2 px-1.5 py-0 text-[10px]"
                    >
                      {showVerbNegation ? "Active" : "None"}
                    </Badge>
                  </button>

                  {showVerbNegation && (
                    <div className="relative mt-1 flex flex-col gap-1 border-s-2 border-slate-200 ps-2 ms-2">
                      <GrammarSelectField
                        label={{ arabic: "أداة النفي", english: "Particle" }}
                        currentValue={v.negation?.particle ?? "لا"}
                        options={[
                          { value: "لا", arabic: "لا", english: "La" },
                          { value: "ما", arabic: "ما", english: "Ma" },
                          { value: "لم", arabic: "لم", english: "Lam" },
                          { value: "لن", arabic: "لن", english: "Lan" },
                          { value: "other", arabic: "أخرى", english: "Other" },
                        ]}
                        onValueChange={(val) =>
                          updateField("negation", {
                            ...(v.negation || { type: "normal_negation" }),
                            particle: val,
                          })
                        }
                      />

                      <GrammarSelectField
                        label={{ arabic: "نوع النفي", english: "Type" }}
                        currentValue={v.negation?.type ?? "normal_negation"}
                        options={[
                          { value: "normal_negation", arabic: "نفي", english: "Normal Negation" },
                          { value: "prohibition", arabic: "نهي", english: "Prohibition (Negative Command)" },
                        ]}
                        onValueChange={(val) =>
                          updateField("negation", {
                            ...(v.negation || { particle: "لا" }),
                            type: val,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Verb Attached Pronouns Branch */}
              <div className="relative mt-1 ps-4">
                <span className="absolute -left-0.5 top-4 h-px w-3.5 bg-slate-300" />
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !showAttachedPronoun;
                    setShowAttachedPronoun(nextState);
                    if (!nextState) {
                      updateField("attached_pronouns", undefined);
                    } else if (!v.attached_pronouns?.length) {
                      updateField("attached_pronouns", [
                        {
                          role: "direct_object",
                          person: 3,
                          gender: "masculine",
                          number: "singular",
                        },
                      ]);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg py-1 font-bold text-slate-700 hover:text-sky-600 transition"
                >
                  {showAttachedPronoun ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span dir="rtl" lang="ar" className="font-arabic">
                    الضمائر المتصلة
                  </span>
                  <span className="text-slate-300">-</span>
                  <span>Attached Pronouns</span>
                  <Badge
                    variant={showAttachedPronoun ? "secondary" : "outline"}
                    className="ms-2 px-1.5 py-0 text-[10px]"
                  >
                    {showAttachedPronoun ? "Active" : "None"}
                  </Badge>
                </button>

                {showAttachedPronoun && (
                  <div className="relative mt-1 flex flex-col gap-1 border-s-2 border-slate-200 ps-2 ms-2">
                    <GrammarSelectField
                      label={{ arabic: "وظيفة الضمير", english: "Role" }}
                      currentValue={v.attached_pronouns?.[0]?.role ?? "direct_object"}
                      options={[
                        { value: "direct_object", arabic: "مفعول به", english: "Direct Object" },
                        { value: "subject", arabic: "فاعل", english: "Subject" },
                      ]}
                      onValueChange={(val) =>
                        updateField("attached_pronouns", [
                          {
                            ...(v.attached_pronouns?.[0] || {
                              person: 3,
                              gender: "masculine",
                              number: "singular",
                            }),
                            role: val,
                          },
                        ])
                      }
                    />

                    <GrammarSelectField
                      label={{ arabic: "الشخص", english: "Person" }}
                      currentValue={v.attached_pronouns?.[0]?.person ?? 3}
                      isNumeric
                      options={[
                        { value: 1, arabic: "المتكلم", english: "1st Person" },
                        { value: 2, arabic: "المخاطب", english: "2nd Person" },
                        { value: 3, arabic: "الغائب", english: "3rd Person" },
                      ]}
                      onValueChange={(val) =>
                        updateField("attached_pronouns", [
                          {
                            ...(v.attached_pronouns?.[0] || {
                              role: "direct_object",
                              gender: "masculine",
                              number: "singular",
                            }),
                            person: val as 1 | 2 | 3,
                          },
                        ])
                      }
                    />

                    <GrammarSelectField
                      label={{ arabic: "الجنس", english: "Gender" }}
                      currentValue={v.attached_pronouns?.[0]?.gender ?? "masculine"}
                      options={[
                        { value: "masculine", arabic: "مذكر", english: "Masculine" },
                        { value: "feminine", arabic: "مؤنث", english: "Feminine" },
                        { value: "not_distinguished", arabic: "غير مميز", english: "Not Distinguished" },
                      ]}
                      onValueChange={(val) =>
                        updateField("attached_pronouns", [
                          {
                            ...(v.attached_pronouns?.[0] || {
                              role: "direct_object",
                              person: 3,
                              number: "singular",
                            }),
                            gender: val,
                          },
                        ])
                      }
                    />

                    <GrammarSelectField
                      label={{ arabic: "العدد", english: "Number" }}
                      currentValue={v.attached_pronouns?.[0]?.number ?? "singular"}
                      options={[
                        { value: "singular", arabic: "مفرد", english: "Singular" },
                        { value: "dual", arabic: "مثنى", english: "Dual" },
                        { value: "plural", arabic: "جمع", english: "Plural" },
                      ]}
                      onValueChange={(val) =>
                        updateField("attached_pronouns", [
                          {
                            ...(v.attached_pronouns?.[0] || {
                              role: "direct_object",
                              person: 3,
                              gender: "masculine",
                            }),
                            number: val,
                          },
                        ])
                      }
                    />
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Particle Characteristics */}
        {pos === "particle" && (() => {
          const p = grammar as ParticleAnalysis;
          const allowedEffects = getAllowedParticleEffects(p.subtype);

          return (
            <>
              {renderCategoryBranch("subtypes", p.subtype)}
              <GrammarSelectField
                label={{ arabic: "الأثر الإعرابي", english: "Grammatical Effect" }}
                currentValue={p.grammatical_effect?.[0]}
                options={allowedEffects.map((eff) => ({
                  value: eff,
                  ...getCategoryLabel("particle", eff),
                }))}
                onValueChange={(val) =>
                  updateField("grammatical_effect", val ? [val] : undefined)
                }
              />
            </>
          );
        })()}
      </div>
    </div>
  );
}
