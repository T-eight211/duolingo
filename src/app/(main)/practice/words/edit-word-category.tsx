"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { updateWordCategoryAction } from "@/actions/vocabulary";
import { WordTagsInput } from "@/components/word-tags-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function parseTags(categoryStr?: string | null): string[] {
  if (!categoryStr) return [];
  return categoryStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function EditWordCategory({
  wordId,
  english,
  category,
  categories,
  onSaved,
}: {
  wordId: string;
  english: string;
  category?: string | null;
  categories: string[];
  onSaved: (category: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const initialTags = useMemo(() => parseTags(category), [category]);
  const [draftTags, setDraftTags] = useState<string[]>(initialTags);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  function openDialog() {
    setDraftTags(parseTags(category));
    setOpen(true);
  }

  async function save() {
    if (pending.current) return;
    const cleanTags = draftTags.map((t) => t.trim()).filter(Boolean);
    const value = cleanTags.length > 0 ? cleanTags.join(", ") : null;

    if (value && value.length > 200) {
      toast.error("Categories & tags combined must be 200 characters or fewer.");
      return;
    }

    pending.current = true;
    setSaving(true);
    try {
      const result = await updateWordCategoryAction(wordId, value);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(value);
      setOpen(false);
      toast.success(cleanTags.length > 1 ? "Tags updated." : "Category updated.");
    } catch {
      toast.error("Could not update the tags. Please try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {initialTags.length === 0 ? (
          <button
            type="button"
            aria-label={`Add category for ${english}`}
            onClick={openDialog}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-500 hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-600 transition cursor-pointer"
          >
            <Plus className="size-3" />
            <span>Add tag</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {initialTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={openDialog}
                aria-label={`Edit tag ${tag} for ${english}`}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition cursor-pointer"
              >
                <Tag className="size-2.5 text-sky-400" />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending.current) {
            setOpen(next);
            if (next) setDraftTags(parseTags(category));
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-neutral-800">
              Edit categories & tags
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add multiple tags or categories for “{english}”.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <WordTagsInput
              id={`word-tags-${wordId}`}
              tags={draftTags}
              onTagsChange={setDraftTags}
              existingSuggestions={categories}
              disabled={saving}
              placeholder="Type category name (e.g. Lesson 1, Verbs)..."
              label="Assigned Tags"
              description="Type a name and press Enter or comma. Suggestions will appear as you type."
            />
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={save}
              className="min-w-[100px] font-bold"
            >
              {saving ? "Saving…" : "Save Tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
