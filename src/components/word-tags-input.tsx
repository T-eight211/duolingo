"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const DEFAULT_TAG_SUGGESTIONS = [
  "Chapter 1",
  "Chapter 2",
  "Chapter 3",
  "General Vocabulary",
  "Verbs",
  "Nouns",
  "Food & Drinks",
  "Family",
  "Travel",
  "Grammar",
] as const;

export const DEFAULT_MAX_TAGS = 6;

export type WordTagsInputProps = {
  id?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  existingSuggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  label?: string;
  description?: string;
  className?: string;
};

export function WordTagsInput({
  id: customId,
  tags,
  onTagsChange,
  existingSuggestions = [],
  placeholder = "Add category or tag...",
  maxTags = DEFAULT_MAX_TAGS,
  disabled = false,
  error: controlledError,
  onErrorChange,
  label = "Categories & Tags",
  description,
  className,
}: WordTagsInputProps) {
  const generatedId = useId();
  const id = customId || `tags-${generatedId}`;
  const listId = `tags-list-${generatedId}`;

  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [localError, setLocalError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const error = controlledError !== undefined ? controlledError : localError;
  function setError(msg: string | null) {
    setLocalError(msg);
    onErrorChange?.(msg);
  }

  const suggestions = useMemo(() => {
    const selected = new Set(tags.map((t) => t.trim().toLowerCase()));
    const query = inputValue.trim().toLowerCase();

    // Pool of available suggestions
    const pool = Array.from(
      new Set(
        [...existingSuggestions, ...DEFAULT_TAG_SUGGESTIONS]
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    if (!query) {
      // Empty input: show top recommendations not already chosen
      return pool.filter((s) => !selected.has(s.toLowerCase())).slice(0, 8);
    }

    // Filter matching suggestions
    const matched = pool.filter(
      (s) =>
        s.toLowerCase().includes(query) && !selected.has(s.toLowerCase()),
    );

    // If query isn't an exact match, allow creating it
    const exactMatch = pool.some((s) => s.toLowerCase() === query);
    if (!exactMatch && !selected.has(query)) {
      matched.push(`+ Create "${inputValue.trim()}"`);
    }

    return matched;
  }, [inputValue, tags, existingSuggestions]);

  const showSuggestions = open && suggestions.length > 0 && !disabled;
  const atMax = tags.length >= maxTags;

  useEffect(() => {
    setActiveIndex(-1);
  }, [inputValue]);

  // Click outside listener
  useEffect(() => {
    if (!showSuggestions) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSuggestions]);

  function addTag(rawValue: string) {
    let clean = rawValue.trim().replace(/^[,]+|[,]+$/g, "");
    if (clean.startsWith('+ Create "') && clean.endsWith('"')) {
      clean = clean.slice(10, -1).trim();
    }

    if (!clean) return;

    if (clean.length > 40) {
      setError("Tag must be 40 characters or fewer.");
      return;
    }

    if (tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setError(`"${clean}" has already been added.`);
      return;
    }

    if (tags.length >= maxTags) {
      setError(`You can add up to ${maxTags} tags.`);
      return;
    }

    onTagsChange([...tags, clean]);
    setInputValue("");
    setError(null);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function removeTag(tagToRemove: string) {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id} className="text-xs font-bold text-neutral-700">
          {label}
        </Label>
      )}

      <div
        ref={containerRef}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
        className={cn(
          "relative flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-2.5 py-1.5 text-sm transition-all cursor-text",
          "focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100",
          error && "border-rose-400 bg-rose-50/20 focus-within:border-rose-400 focus-within:ring-rose-100",
          disabled && "opacity-60 pointer-events-none bg-slate-50",
        )}
        aria-invalid={Boolean(error)}
      >
        {/* Rendered Chips */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-6 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100/80"
          >
            <Tag className="size-2.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="size-4 inline-flex items-center justify-center rounded text-sky-400 hover:text-sky-700 hover:bg-sky-200/50 transition cursor-pointer"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}

        {/* Inline Input Field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-invalid={Boolean(error)}
          disabled={disabled || atMax}
          placeholder={tags.length === 0 ? placeholder : atMax ? "" : "+ add another..."}
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setError(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (showSuggestions) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  current < suggestions.length - 1 ? current + 1 : 0,
                );
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) =>
                  current > 0 ? current - 1 : suggestions.length - 1,
                );
                return;
              }

              if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                addTag(suggestions[activeIndex]);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
                return;
              }

              if (event.key === "Tab" && activeIndex >= 0) {
                event.preventDefault();
                addTag(suggestions[activeIndex]);
                return;
              }
            }

            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(inputValue);
            }

            if (
              event.key === "Backspace" &&
              !inputValue &&
              tags.length > 0
            ) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          className="h-7 min-w-[110px] flex-1 border-0 bg-transparent p-0 text-xs font-semibold text-neutral-800 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0"
        />

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1.5 max-h-56 w-full overflow-auto rounded-2xl border-2 border-slate-200 bg-white p-1.5 shadow-xl text-neutral-700 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {suggestions.map((suggestion, index) => {
              const isCreateOption = suggestion.startsWith('+ Create "');

              return (
                <li
                  key={suggestion}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition flex items-center justify-between",
                    index === activeIndex
                      ? isCreateOption
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sky-50 text-sky-700"
                      : isCreateOption
                        ? "hover:bg-emerald-50/70 text-emerald-600"
                        : "hover:bg-slate-100 text-slate-700",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="flex items-center gap-1.5">
                    {isCreateOption ? (
                      <Plus className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Tag className="size-3 text-slate-400 shrink-0" />
                    )}
                    <span>{suggestion}</span>
                  </span>
                  {index === activeIndex && (
                    <span className="text-[10px] font-semibold opacity-60">
                      Press ↵
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Helper text or Error message */}
      {error ? (
        <p role="alert" className="text-xs font-bold text-rose-500">
          {error}
        </p>
      ) : description ? (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      ) : (
        <p className="text-[11px] text-slate-400">
          Add up to {maxTags} tags. Press Enter or comma after each.
        </p>
      )}
    </div>
  );
}
