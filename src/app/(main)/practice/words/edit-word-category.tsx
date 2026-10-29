"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { updateWordCategoryAction } from "@/actions/vocabulary";
import { CategoryCombobox } from "@/components/category-combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

export function EditWordCategory({ wordId, english, category, categories, onSaved }: {
  wordId: string;
  english: string;
  category?: string | null;
  categories: string[];
  onSaved: (category: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(category ?? "");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  async function save() {
    if (pending.current) return;
    const value = draft.trim() || null;
    if (value && value.length > 100) {
      toast.error("Category must be 100 characters or fewer.");
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const result = await updateWordCategoryAction(wordId, value);
      if (!result.success) { toast.error(result.error); return; }
      onSaved(value);
      setOpen(false);
      toast.success("Category updated.");
    } catch {
      toast.error("Could not update the category. Please try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!pending.current) { setOpen(next); if (next) setDraft(category ?? ""); } }}>
      <Badge asChild variant="outline" className="cursor-pointer rounded-lg border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700 hover:bg-sky-100">
        <button type="button" aria-label={`Edit category for ${english}`} aria-haspopup="dialog" onClick={() => { setDraft(category ?? ""); setOpen(true); }}>
          {category || "Add category"}
        </button>
      </Badge>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>Choose or create a category for “{english}”.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`category-${wordId}`}>Category</FieldLabel>
          <CategoryCombobox clearable id={`category-${wordId}`} value={draft} onValueChange={setDraft} existingCategories={categories} disabled={saving} placeholder="Select or create category" />
        </Field>
        <DialogFooter>
          <Button type="button" variant="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save category"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
