"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ChevronDown,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { saveWordGrammarAction } from "@/actions/vocabulary";
import { GrammarBadges } from "@/components/grammar/grammar-badges";
import { GrammarEditor } from "@/components/grammar/grammar-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditWordCategory } from "./edit-word-category";
import { Spinner } from "@/components/ui/spinner";
import type { ArabicGrammar } from "@/lib/grammar/types";
import { cn } from "@/lib/utils";
import type { VocabularyEntry } from "@/lib/vocabulary/schema";
import { matchesVocabularySearch } from "@/lib/vocabulary/search";

type PosFilter = "all" | "noun" | "verb" | "particle";
type StatusFilter = "all" | "needs-practice" | "mastered" | "unpracticed";
type SortOption = "recent" | "alphabetical" | "errors";

export function WordList({ entries }: { entries: VocabularyEntry[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPos, setSelectedPos] = useState<PosFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("recent");

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

  const vocabulary = useMemo(
    () =>
      entries.map((word) => ({
        ...word,
        ...(localOverrides[word.id] || {}),
      })),
    [entries, localOverrides],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          vocabulary.flatMap((w) =>
            w.category
              ? w.category
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
              : [],
          ),
        ),
      ).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [vocabulary],
  );

  const wordsNeedingPracticeCount = useMemo(
    () => vocabulary.filter((w) => (w.errorCount ?? 0) > 0).length,
    [vocabulary],
  );

  const filteredWords = useMemo(() => {
    return vocabulary.filter((word) => {
      // 1. Search Query: Matches English or Arabic (with or without tashkeel / spelling variants)
      if (!matchesVocabularySearch(word, searchQuery)) {
        return false;
      }

      // 2. Category / Tag Filter
      if (selectedCategory !== "all") {
        const wordTags = word.category
          ? word.category.split(",").map((c) => c.trim().toLowerCase())
          : [];
        if (!wordTags.includes(selectedCategory.toLowerCase())) {
          return false;
        }
      }

      // 3. Part of Speech Filter
      if (selectedPos !== "all" && word.partOfSpeech !== selectedPos) {
        return false;
      }

      // 4. Status Filter
      if (selectedStatus === "needs-practice") {
        if ((word.errorCount ?? 0) <= 0) return false;
      } else if (selectedStatus === "mastered") {
        if ((word.correctCount ?? 0) <= 0 || (word.errorCount ?? 0) > 0)
          return false;
      } else if (selectedStatus === "unpracticed") {
        if ((word.errorCount ?? 0) > 0 || (word.correctCount ?? 0) > 0)
          return false;
      }

      return true;
    });
  }, [vocabulary, searchQuery, selectedCategory, selectedPos, selectedStatus]);

  const words = useMemo(() => {
    const list = [...filteredWords];
    if (sort === "alphabetical") {
      return list.sort((a, b) => a.arabic.localeCompare(b.arabic, "ar"));
    }
    if (sort === "errors") {
      return list.sort((a, b) => (b.errorCount ?? 0) - (a.errorCount ?? 0));
    }
    return list;
  }, [filteredWords, sort]);

  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedCategory !== "all" ||
    selectedPos !== "all" ||
    selectedStatus !== "all";

  function clearAllFilters() {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedPos("all");
    setSelectedStatus("all");
  }

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
          ...prev[word.id],
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
      {/* Header with Counter and Sort Selector */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="words-heading" className="text-xl font-bold text-neutral-800">
            {words.length} {words.length === 1 ? "word" : "words"}
          </h2>
          {isFiltered && vocabulary.length > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">
              (filtered from {vocabulary.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sky-500">
          <ArrowDownAZ className="h-5 w-5 shrink-0" aria-hidden="true" />
          <label htmlFor="word-sort" className="sr-only">
            Sort words
          </label>
          <select
            id="word-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-xl border-2 border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-700 hover:border-slate-300 focus-visible:outline-sky-500 cursor-pointer"
          >
            <option value="recent">Recently added</option>
            <option value="alphabetical">Alphabetical (أ-ي)</option>
            <option value="errors">Most errors first</option>
          </select>
        </div>
      </div>

      {/* Search Bar & Filters Controls */}
      <div className="mb-4 flex flex-col gap-2.5">
        {/* Full-width dual-language search input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in English or Arabic (e.g. merchant, تاجر)..."
            className="w-full pl-10 pr-10 h-11 rounded-2xl border-2 border-slate-200 bg-white text-sm font-bold text-neutral-800 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-100 placeholder:text-slate-400 shadow-2xs"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Clear search query"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Part of Speech Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 rounded-xl border-2 px-3 text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedPos !== "all"
                    ? "border-sky-500 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <SlidersHorizontal className="size-3.5 shrink-0" />
                <span>
                  {selectedPos === "all"
                    ? "Part of Speech"
                    : selectedPos === "noun"
                      ? "Noun (اسم)"
                      : selectedPos === "verb"
                        ? "Verb (فعل)"
                        : "Particle (حرف)"}
                </span>
                <ChevronDown className="size-3 ml-0.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 rounded-xl p-1.5 font-bold">
              <DropdownMenuRadioGroup
                value={selectedPos}
                onValueChange={(v) => setSelectedPos(v as PosFilter)}
              >
                <DropdownMenuRadioItem value="all">
                  All Parts of Speech
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="noun">
                  Noun · اسم
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="verb">
                  Verb · فعل
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="particle">
                  Particle · حرف
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status / Mastery Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 rounded-xl border-2 px-3 text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedStatus !== "all"
                    ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <Filter className="size-3.5 shrink-0" />
                <span>
                  {selectedStatus === "all"
                    ? "Status"
                    : selectedStatus === "needs-practice"
                      ? "Needs Practice"
                      : selectedStatus === "mastered"
                        ? "Mastered"
                        : "Unpracticed"}
                </span>
                {selectedStatus === "all" && wordsNeedingPracticeCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-black text-rose-600">
                    {wordsNeedingPracticeCount}
                  </span>
                )}
                <ChevronDown className="size-3 ml-0.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-xl p-1.5 font-bold">
              <DropdownMenuRadioGroup
                value={selectedStatus}
                onValueChange={(v) => setSelectedStatus(v as StatusFilter)}
              >
                <DropdownMenuRadioItem value="all">
                  All Words
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="needs-practice">
                  Needs Practice {wordsNeedingPracticeCount > 0 && `(${wordsNeedingPracticeCount})`}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mastered">
                  Mastered Words
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unpracticed">
                  Unpracticed Words
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 h-9 rounded-xl border-2 border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition cursor-pointer"
              title="Reset search and filters"
            >
              <RotateCcw className="size-3 shrink-0" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
              const count = vocabulary.filter((w) => {
                const wordTags = w.category
                  ? w.category.split(",").map((c) => c.trim().toLowerCase())
                  : [];
                return wordTags.includes(cat.toLowerCase());
              }).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === cat ? "all" : cat))
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-all border cursor-pointer",
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
      </div>

      {vocabulary.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-500 mb-3 shadow-2xs">
            <Volume2 className="size-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">
            No words added yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Upload an image or document above to extract vocabulary, learn
            grammar, and build your list of Arabic words.
          </p>
        </div>
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3 shadow-2xs">
            <Search className="size-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">
            No words match your search
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery.trim().length > 0
              ? `No results found for "${searchQuery.trim()}".`
              : "No words match the selected filters."}{" "}
            Try searching for another word or reset your filters.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={clearAllFilters}
            className="mt-4 rounded-xl font-bold border-2"
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Clear all filters
          </Button>
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
                        speakingId === word.id &&
                          "animate-pulse text-sky-600 bg-sky-100/70",
                      )}
                    >
                      <Volume2
                        className="size-6 stroke-[2.25]"
                        aria-hidden="true"
                      />
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
                        <EditWordCategory
                          wordId={word.id}
                          english={word.english}
                          category={word.category}
                          categories={categories}
                          onSaved={(category) => {
                            setLocalOverrides((prev) => ({
                              ...prev,
                              [word.id]: { ...prev[word.id], category },
                            }));
                            if (
                              selectedCategory !== "all" &&
                              category !== selectedCategory
                            ) {
                              setSelectedCategory("all");
                            }
                            router.refresh();
                          }}
                        />
                        {word.errorCount !== undefined &&
                          word.errorCount > 0 && (
                            <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                              {word.errorCount}{" "}
                              {word.errorCount === 1 ? "error" : "errors"}
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
    </section>
  );
}
