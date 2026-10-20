"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  extractionResultSchema,
  type VocabularyEntry,
} from "@/lib/vocabulary/schema";
import { VocabularyReviewDialog } from "./vocabulary-review-dialog";

export function VocabularyUpload({
  existingEntries,
}: {
  existingEntries: VocabularyEntry[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function upload(file?: File) {
    if (!file || requestRef.current) return;
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      const message =
        file.size === 0
          ? "This file is empty. Choose an image or PDF."
          : "Choose a file smaller than 4 MB.";
      setError(message);
      toast.error(message);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setExtracting(true);
    setError(null);
    const timeout = setTimeout(() => controller.abort("timeout"), 110_000);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/vocabulary/extract", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : response.status === 413
              ? "Choose a file smaller than 4 MB."
              : "The upload could not be processed. Please try again.";
        throw new Error(message);
      }
      const result = extractionResultSchema.safeParse(body);
      if (!result.success || result.data.entries.length === 0) {
        throw new Error(
          "The AI could not read this document. Try exporting it again or upload a clear image.",
        );
      }
      setEntries(result.data.entries);
      setWarnings(result.data.warnings);
      setReviewVersion((version) => version + 1);
      setOpen(true);
    } catch (caught) {
      if (
        !controller.signal.aborted ||
        controller.signal.reason === "timeout"
      ) {
        const message = controller.signal.aborted
          ? "Extraction took too long. Try a smaller document or clearer image."
          : caught instanceof Error
            ? caught.message
            : "The upload failed. Please try again.";
        setError(message);
        toast.error(message);
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setExtracting(false);
      }
    }
  }

  function selected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void upload(file);
  }

  function discard() {
    setOpen(false);
    setEntries([]);
    setWarnings([]);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,image/*"
        className="hidden"
        aria-label="Upload vocabulary photo or document"
        onChange={selected}
      />
      {entries.length > 0 ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 font-bold"
            onClick={() => setOpen(true)}
          >
            Review ({entries.length})
          </Button>
          <Button variant="ghost" size="lg" onClick={discard}>
            Discard
          </Button>
        </div>
      ) : (
        <Button
          variant="primaryOutline"
          size="lg"
          className="w-full gap-2 font-bold"
          disabled={extracting}
          onClick={() => fileInputRef.current?.click()}
        >
          {extracting ? (
            <>
              <Spinner className="mr-2" aria-hidden="true" /> Adding words…
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" aria-hidden="true" /> Add words
            </>
          )}
        </Button>
      )}
      <VocabularyReviewDialog
        key={reviewVersion}
        open={open}
        onOpenChange={setOpen}
        entries={entries}
        onEntriesChange={setEntries}
        existingEntries={existingEntries}
        warnings={warnings}
        onSaved={discard}
      />
    </div>
  );
}
