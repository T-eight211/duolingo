"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { saveWordGrammarAction } from "@/actions/vocabulary";
import { GrammarBadges } from "@/components/grammar/grammar-badges";
import { GrammarEditor } from "@/components/grammar/grammar-editor";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { arabicCourse } from "@/lib/arabic-course";
import type { ArabicGrammar } from "@/lib/grammar/types";
import { cn } from "@/lib/utils";
import { vocabularyKey, type VocabularyEntry } from "@/lib/vocabulary/schema";

const starters: VocabularyEntry[] = arabicCourse.lessons
  .flatMap((lesson) => lesson.words)
  .map((word, index) => ({
    id: `starter-${index}`,
    kind: "word" as const,
    arabic: word.word,
    arabicDiacritized: word.word,
    english: word.translation,
    originalArabic: null,
    originalEnglish: null,
    corrections: [],
    needsReview: false,
    reviewReason: null,
    partOfSpeech: null,
    grammar: null,
    sourceIds: [],
  }));

export function WordList({ entries }: { entries: VocabularyEntry[] }) {
  const router = useRouter();
  const [sort, setSort] = useState("recent");
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

  const savedWords = entries.filter((entry) => entry.kind === "word");
  const savedKeys = new Set(savedWords.map(vocabularyKey));
  const vocabulary = [
    ...savedWords,
    ...starters.filter((entry) => !savedKeys.has(vocabularyKey(entry))),
  ].map((word) => ({
    ...word,
    ...(localOverrides[word.id] || {}),
  }));

  const sentences = entries.filter((entry) => entry.kind !== "word");
  const words =
    sort === "alphabetical"
      ? [...vocabulary].sort((a, b) => a.arabic.localeCompare(b.arabic, "ar"))
      : vocabulary;

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
                <div className="min-w-0 flex-1">
                  <p
                    lang="ar"
                    dir="rtl"
                    className="w-fit text-2xl leading-relaxed font-bold text-neutral-800"
                  >
                    {word.arabicDiacritized || word.arabic}
                  </p>
                  <p className="mt-1 text-base text-muted-foreground">
                    {word.english}
                  </p>

                  {word.grammar && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <GrammarBadges
                        grammar={word.grammar}
                        interactive
                        onClick={() => toggleExpand(word.id)}
                      />
                    </div>
                  )}
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

              {/* Expandable Hierarchical Editor */}
              {isExpanded && (
                <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <GrammarEditor
                    grammar={activeGrammar}
                    wordText={word.arabicDiacritized || word.arabic}
                    englishText={word.english}
                    onChange={(updated) => {
                      setDraftGrammar((prev) => ({
                        ...prev,
                        [word.id]: updated,
                      }));
                    }}
                  />

                  {/* Footer actions for the editor */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(word.id)}
                        className="rounded-xl text-xs font-semibold"
                      >
                        Close
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isSaving}
                        onClick={() => handleSaveGrammar(word)}
                        className="min-w-[100px] rounded-xl text-xs font-bold"
                      >
                        {isSaving && <Spinner className="h-3.5 w-3.5" />}
                        <span>{isSaving ? "Saving…" : "Save Grammar"}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
