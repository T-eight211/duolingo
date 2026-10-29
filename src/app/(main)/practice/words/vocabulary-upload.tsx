"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createEmptyVocabularyEntry,
  extractionResultSchema,
  type VocabularyEntry,
} from "@/lib/vocabulary/schema";
import { VocabularyCropDialog } from "./vocabulary-crop-dialog";
import { VocabularyReviewDialog } from "./vocabulary-review-dialog";

export function VocabularyUpload({
  existingEntries,
}: {
  existingEntries: VocabularyEntry[];
}) {
  const [cropSource, setCropSource] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => () => { if (cropSource) URL.revokeObjectURL(cropSource.url); }, [cropSource]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function upload(file?: File) {
    if (!file || requestRef.current) return;
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      const message =
        file.size === 0
          ? "This file is empty. Choose an image or PDF."
          : "Choose a file smaller than 20 MB.";
      setError(message);
      toast.error(message);
      return;
    }
    const startedAt = performance.now();
    const controller = new AbortController();
    requestRef.current = controller;
    setExtracting(true);
    setProgress(5);
    setError(null);
    const progressInterval = setInterval(() => {
      // Estimated progress: allow for long AI scans without racing to the end.
      // Only a successful response below completes the bar.
      const elapsedMs = performance.now() - startedAt;
      setProgress(5 + 90 * (1 - Math.exp(-elapsedMs / 60_000)));
    }, 200);
    const timeout = setTimeout(() => controller.abort("timeout"), 290_000);
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
              ? "Choose a file smaller than 20 MB."
              : "The upload could not be processed. Please try again.";
        throw new Error(message);
      }
      const result = extractionResultSchema.safeParse(body);
      if (!result.success || result.data.entries.length === 0) {
        throw new Error(
          "The AI could not read this document. Try exporting it again or upload a clear image.",
        );
      }
      clearInterval(progressInterval);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      setEntries(result.data.entries);
      setWarnings(result.data.warnings);
      setReviewVersion((version) => version + 1);
      setCropSource(null);
      setOpen(true);
    } catch (caught) {
      if (
        !controller.signal.aborted ||
        controller.signal.reason === "timeout"
      ) {
        console.warn("Vocabulary upload failed", {
          elapsedMs: Math.round(performance.now() - startedAt),
          uploadBytes: file.size,
          aborted: controller.signal.aborted,
          errorType: caught instanceof Error ? caught.name : "UnknownError",
        });
        const message = controller.signal.aborted
          ? "Extraction took too long. Try a smaller document or clearer image."
          : caught instanceof TypeError
            ? "The connection was interrupted while scanning. Keep this page open and try Confirm again; your crop is still here."
          : caught instanceof Error
            ? caught.message
            : "The upload failed. Please try again.";
        setError(message);
        toast.error(message);
      }
    } finally {
      clearInterval(progressInterval);
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setExtracting(false);
        setProgress(0);
      }
    }
  }

  function selected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || requestRef.current) return;
    setError(null);
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      toast.error(file.size === 0 ? "This file is empty." : "Choose a file smaller than 20 MB.");
      return;
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      void upload(file);
    } else if (file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name)) {
      setCropSource({ file, url: URL.createObjectURL(file) });
    } else {
      toast.error("Choose an image or PDF.");
    }
  }

  function discard() {
    setOpen(false);
    setEntries([]);
    setWarnings([]);
  }

  function handleOpenManual() {
    if (extracting) return;
    if (entries.length === 0) {
      setEntries([createEmptyVocabularyEntry()]);
      setReviewVersion((v) => v + 1);
    }
    setOpen(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // If user closed dialog and all entries are empty, discard them
      const hasContent = entries.some(
        (e) => e.arabic.trim().length > 0 || e.english.trim().length > 0,
      );
      if (!hasContent) {
        setEntries([]);
      }
    }
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
        <div className="relative flex w-full items-center">
          <Button
            variant="default"
            size="lg"
            className="relative w-full overflow-hidden disabled:opacity-100 font-bold border-2 border-slate-200 pr-14"
            disabled={extracting}
            onClick={handleOpenManual}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Plus className="h-5 w-5" aria-hidden="true" />
              {extracting && !cropSource ? "Processing..." : "Add words"}
            </span>
          </Button>
          <button
            type="button"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
            title="Scan document or image with AI"
            aria-label="Scan document or image with AI"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none"
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
      {cropSource && (
        <VocabularyCropDialog
          key={cropSource.url}
          source={cropSource}
          busy={extracting}
          progress={progress}
          error={error}
          onClose={() => { setCropSource(null); setError(null); }}
          onConfirm={upload}
        />
      )}
      <VocabularyReviewDialog
        key={reviewVersion}
        open={open}
        onOpenChange={handleOpenChange}
        entries={entries}
        onEntriesChange={setEntries}
        existingEntries={existingEntries}
        warnings={warnings}
        onSaved={discard}
      />
    </div>
  );
}
