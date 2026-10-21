"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ChevronDown, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { saveWordGrammarAction } from "@/actions/vocabulary";
import { GrammarBadges } from "@/components/grammar/grammar-badges";
import { GrammarEditor } from "@/components/grammar/grammar-editor";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ArabicGrammar } from "@/lib/grammar/types";
import { cn } from "@/lib/utils";
import { type VocabularyEntry } from "@/lib/vocabulary/schema";

export function WordList({ entries }: { entries: VocabularyEntry[] }) {
  const router = useRouter();
  const [sort, setSort] = useState("recent");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Partial<VocabularyEntry>>
  >({});
  const [draftGrammar, setDraftGrammar] = useState<
    Record<string, ArabicGrammar>
  >({});
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  function playAudio(word: VocabularyEntry) {
    if (typeof window === "undefined" || !word.audioSrc) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setSpeakingId(word.id);
    const audio = new Audio(word.audioSrc);
    currentAudioRef.current = audio;

    audio.onended = () => {
      setSpeakingId(null);
      currentAudioRef.current = null;
    };
    audio.onerror = () => {
      setSpeakingId(null);
      currentAudioRef.current = null;
      toast.error("Failed to play audio.");
    };
    audio.play().catch(() => {
      setSpeakingId(null);
      currentAudioRef.current = null;
    });
  }

  const savedWords = entries.filter((entry) => entry.kind === "word");
  const vocabulary = savedWords.map((word) => ({
    ...word,
    ...(localOverrides[word.id] || {}),
  }));

  const categories = Array.from(
    new Set(
      vocabulary
        .map((w) => w.category?.trim())
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    ),
  ).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  const filteredWords =
    selectedCategory === "all"
      ? vocabulary
      : vocabulary.filter((w) => w.category === selectedCategory);

  const sentences = entries.filter((entry) => entry.kind !== "word");
  const words =
    sort === "alphabetical"
      ? [...filteredWords].sort((a, b) => a.arabic.localeCompare(b.arabic, "ar"))
      : filteredWords;

  function toggleExpand(id: string) {
    setExpandedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSaveGrammar(word: VocabularyEntry) {
    const grammarToSave = draftGrammar[word.id] ?? word.grammar;
    if (!grammarToSave) {
      toast.error("No grammar to save.");
      return;
    }

    setSavingIds((prev) => new Set(prev).add(word.id));
    try {
      const res = await saveWordGrammarAction(word.id, grammarToSave, {
        arabic: word.arabic,
        arabicDiacritized: word.arabicDiacritized,
        english: word.english,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      toast.success("Grammar saved successfully!");
      setLocalOverrides((prev) => ({
        ...prev,
        [word.id]: {
          partOfSpeech: grammarToSave.part_of_speech,
          grammar: grammarToSave,
        },
      }));
      setExpandedWordIds((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
      setDraftGrammar((prev) => {
        const next = { ...prev };
        delete next[word.id];
        return next;
      });
      router.refresh();
    } catch {
      toast.error("Failed to save grammar changes.");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }
  }

  return (
    <section className="mt-8 border-t-2 pt-6" aria-labelledby="words-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="words-heading" className="text-xl font-bold text-neutral-800">
          {words.length} words
        </h2>
        <div className="flex items-center gap-2 text-sky-500">
          <ArrowDownAZ className="h-5 w-5" aria-hidden="true" />
          <label htmlFor="word-sort" className="sr-only">
            Sort words
          </label>
          <select
            id="word-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="max-w-[160px] rounded-lg border-0 bg-white py-2 text-sm font-bold focus-visible:outline-sky-500"
          >
            <option value="recent">Recently added</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold transition-all",
              selectedCategory === "all"
                ? "bg-neutral-800 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            All ({vocabulary.length})
          </button>
          {categories.map((cat) => {
            const count = vocabulary.filter((w) => w.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold transition-all border",
                  selectedCategory === cat
                    ? "bg-sky-500 text-white border-sky-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/50",
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {words.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-500 mb-3 shadow-2xs">
            <Volume2 className="size-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">No words added yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Upload an image or document above to extract vocabulary, learn grammar, and build your list of Arabic words.
          </p>
        </div>
      ) : (
        <ul className="divide-y-2 overflow-hidden rounded-xl border-2 border-b-4 bg-white">
        {words.map((word) => {
          const isExpanded = expandedWordIds.has(word.id);
          const isSaving = savingIds.has(word.id);
          const activeGrammar = draftGrammar[word.id] ?? word.grammar;

          return (
            <li
              key={word.id}
              className="flex flex-col gap-3 p-5 transition hover:bg-slate-50/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Audio Speaker Button */}
                  <button
                    type="button"
                    onClick={() => playAudio(word)}
                    aria-label={`Play pronunciation for ${word.english}`}
                    className={cn(
                      "mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-sky-500 transition hover:bg-sky-50 hover:text-sky-600 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-400",
                      speakingId === word.id && "animate-pulse text-sky-600 bg-sky-100/70",
                    )}
                  >
                    <Volume2 className="size-6 stroke-[2.25]" aria-hidden="true" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p
                        lang="ar"
                        dir="rtl"
                        className="w-fit text-2xl leading-relaxed font-bold text-neutral-800"
                      >
                        {word.arabicDiacritized || word.arabic}
                      </p>
                      {word.category && (
                        <span className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                          {word.category}
                        </span>
                      )}
                      {word.errorCount !== undefined && word.errorCount > 0 && (
                        <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                          {word.errorCount} {word.errorCount === 1 ? "error" : "errors"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-base text-muted-foreground">
                      {word.english}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {word.grammar && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(word.id)}
                      className="rounded-xl text-xs font-bold text-slate-600 hover:text-neutral-900"
                    >
                      <span>
                        {isExpanded ? "Hide Details" : "Grammar Details"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </Button>
                  </div>
                )}
              </div>

              {word.grammar && (
                <div className="min-w-0 ps-12">
                  <GrammarBadges
                    grammar={word.grammar}
                    interactive
                    onClick={() => toggleExpand(word.id)}
                  />
                </div>
              )}

              {/* Expandable Grammar Editor Panel */}
              {isExpanded && (
                <div className="mt-2 flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5">
                  <GrammarEditor
                    grammar={activeGrammar}
                    onChange={(updated) => {
                      setDraftGrammar((prev) => ({
                        ...prev,
                        [word.id]: updated,
                      }));
                    }}
                  />

                  {/* Footer actions for the editor */}
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(word.id)}
                      className="rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => handleSaveGrammar(word)}
                      className="min-w-[120px] rounded-xl text-xs font-bold uppercase tracking-wide"
                    >
                      {isSaving && <Spinner className="h-3.5 w-3.5" />}
                      <span>{isSaving ? "Saving…" : "Save Grammar"}</span>
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        </ul>
      )}

      {sentences.length > 0 && (
        <section className="mt-8" aria-labelledby="sentences-heading">
          <h2
            id="sentences-heading"
            className="mb-4 text-xl font-bold text-neutral-800"
          >
            Sentences and phrases ({sentences.length})
          </h2>
          <ul className="divide-y-2 overflow-hidden rounded-xl border-2 border-b-4 bg-white">
            {sentences.map((sentence) => (
              <li key={sentence.id} className="min-w-0 p-5">
                <p
                  lang="ar"
                  dir="rtl"
                  className="text-xl leading-relaxed font-bold break-words"
                >
                  {sentence.arabicDiacritized || sentence.arabic}
                </p>
                <p
                  lang="en"
                  dir="ltr"
                  className="mt-2 break-words text-muted-foreground"
                >
                  {sentence.english}
                </p>
                {savedWords.some((word) =>
                  word.sourceIds.includes(sentence.id),
                ) && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-semibold">
                      Words from this sentence
                    </summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {savedWords
                        .filter((word) => word.sourceIds.includes(sentence.id))
                        .map((word) => (
                          <li key={word.id}>
                            <span lang="ar" dir="rtl">
                              {word.arabicDiacritized}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              - {word.english}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
