"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_CATEGORIES = [
  "Lesson 1",
  "Lesson 2",
  "Lesson 3",
  "General Vocabulary",
  "Verbs",
  "Grammar",
] as const;

export function sortCategories(categories: string[]): string[] {
  return [...new Set(categories.map((c) => c.trim()).filter(Boolean))].sort(
    (a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

interface CategoryComboboxProps {
  id?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  existingCategories?: string[];
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}

export function CategoryCombobox({
  id,
  value = "",
  onValueChange,
  existingCategories = [],
  disabled = false,
  clearable = false,
  placeholder = "Select or create category",
  className,
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  const [hasUserTyped, setHasUserTyped] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [categories, setCategories] = React.useState<string[]>(() => {
    const combined = [...DEFAULT_CATEGORIES, ...existingCategories];
    if (value && !combined.includes(value)) {
      combined.push(value);
    }
    return sortCategories(combined);
  });

  React.useEffect(() => {
    setQuery(value);
    setHasUserTyped(false);
  }, [value]);

  React.useEffect(() => {
    setCategories((current) => {
      const combined = [...current, ...existingCategories];
      if (value && !combined.includes(value)) {
        combined.push(value);
      }
      return sortCategories(combined);
    });
  }, [existingCategories, value]);

  // If user hasn't actively typed, show all categories. Only filter when user types.
  const trimmed = query.trim();
  const filtered = React.useMemo(() => {
    if (!hasUserTyped || !trimmed) {
      return categories;
    }
    return categories.filter((c) =>
      c.toLowerCase().includes(trimmed.toLowerCase()),
    );
  }, [categories, hasUserTyped, trimmed]);

  const hasExactMatch = categories.some(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = hasUserTyped && trimmed.length > 0 && !hasExactMatch;

  const totalOptionsCount = filtered.length + (canCreate ? 1 : 0);

  // Close dropdown on outside click and reset query to current selected value
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHasUserTyped(false);
        setQuery(value);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [value]);

  function handleSelect(selected: string) {
    onValueChange?.(selected);
    setQuery(selected);
    setHasUserTyped(false);
    setIsOpen(false);
  }

  function handleCreate(newCategory: string) {
    const trimmedVal = newCategory.trim();
    if (!trimmedVal) return;
    setCategories((prev) => sortCategories([...prev, trimmedVal]));
    onValueChange?.(trimmedVal);
    setQuery(trimmedVal);
    setHasUserTyped(false);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        setHasUserTyped(false);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < totalOptionsCount - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, totalOptionsCount - 1),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate && highlightedIndex === filtered.length) {
        handleCreate(trimmed);
      } else if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHasUserTyped(false);
      setQuery(value);
    }
  }

  function openDropdown() {
    setIsOpen(true);
    setHasUserTyped(false);
    // Position highlight on selected item if available
    const selectedIdx = categories.findIndex(
      (c) => c.toLowerCase() === value.toLowerCase(),
    );
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            openDropdown();
            // Select all text on focus so user can immediately type to replace or filter
            inputRef.current?.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setHasUserTyped(true);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 pe-9 text-xs sm:text-sm font-semibold text-neutral-800 placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 transition"
        />

        <div className="absolute end-1.5 flex items-center">
          <button
            type="button"
            tabIndex={clearable && value ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (clearable && value) {
                handleSelect("");
                inputRef.current?.focus();
                return;
              }
              if (isOpen) {
                setIsOpen(false);
                setHasUserTyped(false);
                setQuery(value);
              } else {
                openDropdown();
                inputRef.current?.focus();
                inputRef.current?.select();
              }
            }}
            className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 transition"
            aria-label={clearable && value ? "Clear category" : "Toggle category list"}
          >
            {clearable && value ? <X className="size-3.5 stroke-[2.5]" /> : <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200 stroke-[2.5]",
                isOpen && "rotate-180",
              )}
            />}
          </button>
        </div>
      </div>

      {/* Dropdown Menu - rendered inline to avoid any Radix Dialog outside-pointer blocking */}
      {isOpen && (
        <div
          className="absolute top-full start-0 mt-1.5 w-full min-w-[200px] z-50 max-h-56 overflow-y-auto no-scrollbar rounded-xl border border-slate-200 bg-white p-1 shadow-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {filtered.length === 0 && !canCreate && (
            <div className="py-2.5 text-center text-xs text-muted-foreground font-medium">
              No categories found.
            </div>
          )}

          {filtered.map((cat, idx) => {
            const isSelected = cat.toLowerCase() === value.toLowerCase();
            const isHighlighted = idx === highlightedIndex;

            return (
              <button
                key={cat}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(cat);
                }}
                className={cn(
                  "relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition cursor-pointer text-start",
                  (isHighlighted || isSelected) && "bg-sky-50 text-sky-700",
                )}
              >
                <span className="truncate">{cat}</span>
                {isSelected && (
                  <Check className="size-3.5 shrink-0 stroke-[3] text-sky-600 ms-2" />
                )}
              </button>
            );
          })}

          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreate(trimmed);
              }}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-bold text-sky-600 transition cursor-pointer text-start border-t border-slate-100 mt-1",
                highlightedIndex === filtered.length && "bg-sky-50 text-sky-700",
              )}
            >
              <Plus className="size-3.5 shrink-0 stroke-[3]" />
              <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
