"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { saveVocabulary } from "@/actions/vocabulary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { GrammarBadges } from "@/components/grammar/grammar-badges";
import { GrammarEditor } from "@/components/grammar/grammar-editor";
import { CategoryCombobox } from "@/components/category-combobox";
import type { ArabicGrammar } from "@/lib/grammar/types";
import { cn } from "@/lib/utils";
import {
  createEmptyVocabularyEntry,
  deduplicateVocabularyEntries,
  saveVocabularySchema,
  stripArabicDiacritics,
  vocabularyKey,
  type VocabularyEntry,
} from "@/lib/vocabulary/schema";

type FieldErrors = Record<string, { arabic?: string; english?: string }>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: VocabularyEntry[];
  onEntriesChange: (entries: VocabularyEntry[]) => void;
  existingEntries: VocabularyEntry[];
  warnings: string[];
  onSaved: () => void;
};

const correctionLabels: Record<VocabularyEntry["corrections"][number], string> =
  {
    arabic_spelling: "Arabic spelling corrected",
    english_spelling: "English spelling corrected",
    translation: "Translation corrected",
    diacritics: "Tashkeel corrected",
  };

export function VocabularyReviewDialog({
  open,
  onOpenChange,
  entries,
  onEntriesChange,
  existingEntries,
  warnings,
  onSaved,
}: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const savingRef = useRef(false);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [expandedGrammarIds, setExpandedGrammarIds] = useState<Set<string>>(
    new Set(),
  );
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [category, setCategory] = useState<string>("Lesson 1");

  const allExistingCategories = Array.from(
    new Set(
      existingEntries
        .map((e) => e.category)
        .filter(
          (c): c is string => typeof c === "string" && c.trim().length > 0,
        ),
    ),
  );

  function playAudio(entry: VocabularyEntry) {
    if (typeof window === "undefined") return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (entry.audioSrc) {
      setSpeakingId(entry.id);
      const audio = new Audio(entry.audioSrc);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setSpeakingId(null);
        currentAudioRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingId(null);
        currentAudioRef.current = null;
        toast.error("Audio playback failed.");
      };
      audio.play().catch(() => {
        setSpeakingId(null);
        currentAudioRef.current = null;
      });
      return;
    }

    toast.error("No audio available for this word.");
  }

  const sentences = entries.filter((entry) => entry.kind !== "word");
  const words = entries.filter((entry) => entry.kind === "word");
  const existingKeys = new Set(existingEntries.map(vocabularyKey));
  const uniqueEntries = deduplicateVocabularyEntries(entries).entries;
  const newCount = uniqueEntries.filter(
    (entry) => !existingKeys.has(vocabularyKey(entry)),
  ).length;
  const duplicateCount = entries.length - newCount;

  function toggleGrammar(id: string) {
    setExpandedGrammarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function updateEntryGrammar(id: string, grammar: ArabicGrammar) {
    onEntriesChange(
      entries.map((entry) => {
        if (entry.id !== id) return entry;
        return {
          ...entry,
          partOfSpeech: grammar.part_of_speech,
          grammar,
        };
      }),
    );
  }

  function updateEntry(
    id: string,
    language: "arabic" | "english",
    value: string,
  ) {
    setError(null);
    setFieldErrors((current) => ({
      ...current,
      [id]: { ...current[id], [language]: undefined },
    }));
    onEntriesChange(
      entries.map((entry) => {
        if (entry.id !== id) return entry;
        return language === "arabic"
          ? {
              ...entry,
              arabic: stripArabicDiacritics(value),
              arabicDiacritized: value,
            }
          : { ...entry, english: value };
      }),
    );
  }

  function removeEntry(id: string) {
    setError(null);
    onEntriesChange(
      entries
        .filter((entry) => entry.id !== id)
        .map((entry) => ({
          ...entry,
          sourceIds: entry.sourceIds.filter((sourceId) => sourceId !== id),
        })),
    );
  }

  function addNewWord() {
    setError(null);
    onEntriesChange([...entries, createEmptyVocabularyEntry()]);
  }

  function submit() {
    if (savingRef.current || entries.length === 0) return;
    const cleanCategory = category.trim() || null;
    const entriesWithCategory = entries.map((entry) => ({
      ...entry,
      category: entry.category || cleanCategory,
    }));
    const parsed = saveVocabularySchema.safeParse({
      category: cleanCategory,
      entries: entriesWithCategory,
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        const field = issue.path[2];
        if (typeof index !== "number" || !entries[index]) continue;
        const id = entries[index].id;
        if (field === "arabic" || field === "arabicDiacritized") {
          nextErrors[id] = { ...nextErrors[id], arabic: issue.message };
        } else if (field === "english") {
          nextErrors[id] = { ...nextErrors[id], english: issue.message };
        }
      }
      setFieldErrors(nextErrors);
      setError(
        "Check the highlighted entries. Each entry needs Arabic and English text.",
      );
      const firstInvalid = Object.entries(nextErrors)[0];
      if (firstInvalid) {
        const [id, errors] = firstInvalid;
        document
          .getElementById(`${errors.arabic ? "arabic" : "english"}-${id}`)
          ?.focus();
      }
      return;
    }

    savingRef.current = true;
    setError(null);
    setFieldErrors({});
    startSaving(async () => {
      try {
        const result = await saveVocabulary(parsed.data);
        if (!result.success) {
          const nextErrors: FieldErrors = {};
          for (const [path, messages] of Object.entries(
            result.fieldErrors ?? {},
          )) {
            const [, index, field] = path.split(".");
            const entry = entries[Number(index)];
            if (!entry) continue;
            const language = field === "arabicDiacritized" ? "arabic" : field;
            if (language === "arabic" || language === "english") {
              nextErrors[entry.id] = {
                ...nextErrors[entry.id],
                [language]: messages[0],
              };
            }
          }
          setFieldErrors(nextErrors);
          setError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success(
          result.added === 0
            ? "These entries are already in your vocabulary."
            : `Added ${result.added} vocabulary ${result.added === 1 ? "entry" : "entries"}.`,
          result.duplicates > 0
            ? {
                description: `${result.duplicates} duplicate ${result.duplicates === 1 ? "entry was" : "entries were"} skipped.`,
              }
            : undefined,
        );
        onSaved();
        router.refresh();
      } catch {
        const message =
          "Your words could not be saved. Your edits are still here; please try again.";
        setError(message);
        toast.error(message);
      } finally {
        savingRef.current = false;
      }
    });
  }

  function renderRow(entry: VocabularyEntry, index: number) {
    const errors = fieldErrors[entry.id];
    const isSentence = entry.kind !== "word";
    const alreadySaved = existingKeys.has(vocabularyKey(entry));
    const sources = sentences.filter((s) => entry.sourceIds.includes(s.id));

    return (
      <li key={entry.id} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* English Tile - Matching pairs card style */}
          <div
            className={cn(
              "relative flex flex-1 items-center justify-center rounded-2xl border-2 border-b-4 border-slate-200 bg-white transition-all",
              "hover:bg-slate-50/80 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100",
              isSentence ? "min-h-[68px] sm:min-h-[76px] p-2.5 sm:p-3" : "h-[58px] sm:h-[72px] px-2 sm:px-3",
              errors?.english &&
                "border-rose-400 bg-rose-50/30 focus-within:border-rose-400 focus-within:ring-rose-100",
            )}
          >
            {isSentence ? (
              <textarea
                id={`english-${entry.id}`}
                value={entry.english}
                onChange={(event) =>
                  updateEntry(entry.id, "english", event.target.value)
                }
                disabled={isSaving}
                aria-label={`English translation ${index + 1}`}
                placeholder="English translation..."
                className="w-full resize-none bg-transparent text-center text-xs font-bold text-neutral-700 placeholder:text-neutral-300 focus:outline-hidden sm:text-sm"
                rows={2}
                maxLength={2400}
              />
            ) : (
              <input
                id={`english-${entry.id}`}
                type="text"
                value={entry.english}
                onChange={(event) =>
                  updateEntry(entry.id, "english", event.target.value)
                }
                disabled={isSaving}
                aria-label={`English word ${index + 1}`}
                placeholder="English..."
                className="w-full bg-transparent text-center text-sm font-bold text-neutral-700 placeholder:text-neutral-300 focus:outline-hidden sm:text-base px-1.5"
                maxLength={2400}
              />
            )}
          </div>

          {/* Arabic Tile - Matching pairs card style */}
          <div
            className={cn(
              "relative flex flex-1 items-center justify-center rounded-2xl border-2 border-b-4 border-slate-200 bg-white transition-all",
              "hover:bg-slate-50/80 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100",
              isSentence ? "min-h-[68px] sm:min-h-[76px] p-2.5 sm:p-3" : "h-[58px] sm:h-[72px] px-2 sm:px-3",
              errors?.arabic &&
                "border-rose-400 bg-rose-50/30 focus-within:border-rose-400 focus-within:ring-rose-100",
            )}
          >
            {isSentence ? (
              <textarea
                id={`arabic-${entry.id}`}
                dir="rtl"
                lang="ar"
                value={entry.arabicDiacritized || entry.arabic}
                onChange={(event) =>
                  updateEntry(entry.id, "arabic", event.target.value)
                }
                disabled={isSaving}
                aria-label={`Arabic sentence ${index + 1}`}
                placeholder="الجملة بالعربية..."
                className="font-arabic w-full resize-none bg-transparent text-center text-sm font-bold text-neutral-800 placeholder:text-neutral-300 focus:outline-hidden sm:text-base pl-8 pr-2 sm:pl-9 sm:pr-3"
                rows={2}
                maxLength={2400}
              />
            ) : (
              <input
                id={`arabic-${entry.id}`}
                type="text"
                dir="rtl"
                lang="ar"
                value={entry.arabicDiacritized || entry.arabic}
                onChange={(event) =>
                  updateEntry(entry.id, "arabic", event.target.value)
                }
                disabled={isSaving}
                aria-label={`Arabic word ${index + 1}`}
                placeholder="الكلمة..."
                className="font-arabic w-full bg-transparent text-center text-base font-bold text-neutral-800 placeholder:text-neutral-300 focus:outline-hidden sm:text-xl pl-8 pr-2 sm:pl-9 sm:pr-3"
                maxLength={2400}
              />
            )}

            {/* Audio Speaker Button inside Arabic card */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playAudio(entry);
              }}
              aria-label={`Play pronunciation for ${entry.english || entry.arabic}`}
              className={cn(
                "absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 z-10 flex size-7 sm:size-8 items-center justify-center rounded-lg sm:rounded-xl text-sky-500 transition hover:bg-sky-50 hover:text-sky-600 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-400",
                speakingId === entry.id && "animate-pulse text-sky-600 bg-sky-100/70",
              )}
            >
              <Volume2 className="size-4 sm:size-4.5 stroke-[2.25]" aria-hidden="true" />
            </button>
          </div>

          {/* Remove Entry Button */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
            disabled={isSaving}
            onClick={() => removeEntry(entry.id)}
            aria-label={`Remove ${entry.kind} ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Pills, Errors & Notes */}
        {(errors?.english ||
          errors?.arabic ||
          entry.needsReview ||
          alreadySaved) && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
            {errors?.english && (
              <span className="font-semibold text-rose-500">
                English: {errors.english}
              </span>
            )}
            {errors?.arabic && (
              <span className="font-semibold text-rose-500">
                Arabic: {errors.arabic}
              </span>
            )}
            {entry.needsReview && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700">
                <AlertCircle className="h-3 w-3" />
                {entry.reviewReason || "Review needed"}
              </span>
            )}
            {alreadySaved && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                Already saved
              </span>
            )}
          </div>
        )}

        {/* Grammar Badges & Hierarchical Grammar Editor */}
        {entry.kind === "word" && (
          <div className="flex flex-col gap-2 px-1 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.grammar && (
                  <GrammarBadges
                    grammar={entry.grammar}
                    interactive
                    onClick={() => toggleGrammar(entry.id)}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleGrammar(entry.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-neutral-800 transition py-0.5 ms-auto ml-auto shrink-0"
              >
                <span>
                  {expandedGrammarIds.has(entry.id)
                    ? "Hide Grammar"
                    : entry.grammar
                      ? "Grammar Details"
                      : "+ Add Grammar"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    expandedGrammarIds.has(entry.id) && "rotate-180",
                  )}
                />
              </button>
            </div>

            {expandedGrammarIds.has(entry.id) && (
              <GrammarEditor
                grammar={entry.grammar}
                wordText={entry.arabicDiacritized || entry.arabic}
                englishText={entry.english}
                onChange={(updated) => updateEntryGrammar(entry.id, updated)}
              />
            )}
          </div>
        )}

        {/* Sentence context links if present */}
        {sources.length > 0 && (
          <details className="px-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold hover:text-foreground">
              Sentence context ({sources.length})
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {sources.map((s) => (
                <li key={s.id}>
                  <span dir="rtl" lang="ar" className="font-bold">
                    {s.arabicDiacritized || s.arabic}
                  </span>{" "}
                  - {s.english}
                </li>
              ))}
            </ul>
          </details>
        )}
      </li>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!savingRef.current) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        dir="ltr"
        className="flex max-h-[88dvh] w-[calc(100%_-_1.25rem)] max-w-2xl sm:max-w-3xl flex-col gap-0 overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-0 shadow-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onInteractOutside={(event) => {
          if (savingRef.current) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (savingRef.current) event.preventDefault();
        }}
      >
        {/* Header - Matching pairs practice style */}
        <DialogHeader className="shrink-0 px-4 pt-5 pb-3 text-start sm:px-8 sm:pt-6 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="text-xl font-bold text-neutral-700 sm:text-2xl"
              >
                Review your words
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground sm:text-base">
                Check each English word with its Arabic translation before adding.
              </DialogDescription>
            </div>
            <div className="w-full sm:w-56 shrink-0 pt-0.5">
              <CategoryCombobox
                value={category}
                onValueChange={setCategory}
                existingCategories={allExistingCategories}
                disabled={isSaving}
                placeholder="Category (e.g. Lesson 1)"
              />
            </div>
          </div>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          noValidate
          aria-busy={isSaving}
        >


          <ScrollArea className="h-[50dvh] min-h-0" dir="ltr">
            <div className="flex min-w-0 flex-col gap-4 p-3.5 sm:gap-5 sm:p-6 sm:px-8">
              {words.length > 0 && (
                <section
                  className="flex flex-col gap-3"
                  aria-label="Vocabulary words"
                >
                  {sentences.length > 0 && (
                    <h3 className="text-sm font-bold text-neutral-600">
                      Words ({words.length})
                    </h3>
                  )}
                  <ul className="flex flex-col gap-3">{words.map(renderRow)}</ul>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full border-2 border-dashed border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-bold h-12 rounded-2xl flex items-center justify-center gap-2"
                    onClick={addNewWord}
                    disabled={isSaving}
                  >
                    <Plus className="h-4 w-4" /> Add another word
                  </Button>
                </section>
              )}

              {sentences.length > 0 && (
                <section
                  className="mt-2 flex flex-col gap-3"
                  aria-label="Sentences and phrases"
                >
                  <h3 className="text-sm font-bold text-neutral-600">
                    Sentences and phrases ({sentences.length})
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {sentences.map(renderRow)}
                  </ul>
                  {words.length === 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full border-2 border-dashed border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-bold h-12 rounded-2xl flex items-center justify-center gap-2"
                      onClick={addNewWord}
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4" /> Add a word
                    </Button>
                  )}
                </section>
              )}

              {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <p className="font-bold text-neutral-700">No words entered yet</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addNewWord}
                    className="font-bold"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add a word
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer - Duolingo action bar */}
          <div className="flex shrink-0 flex-col gap-3 border-t-2 border-slate-100 bg-slate-50/60 p-3.5 sm:px-8 sm:py-5">
            {error && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-neutral-600 shrink-0 whitespace-nowrap sm:whitespace-normal" aria-live="polite">
                <span className="text-neutral-800">
                  {newCount} {newCount === 1 ? "word" : "words"}
                </span>{" "}
                to add
                {duplicateCount > 0 && (
                  <span className="hidden sm:inline font-normal text-muted-foreground">
                    {" "}
                    · {duplicateCount} already saved
                  </span>
                )}
              </p>

              <DialogFooter className="flex-row items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  disabled={isSaving || entries.length === 0}
                  className="min-w-[130px] font-bold"
                >
                  {isSaving && (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                  )}
                  {isSaving ? "Adding…" : "Add Words"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
