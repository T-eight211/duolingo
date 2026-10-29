"use client";

import { useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function VocabularyCropDialog({ source, busy, progress, error, onClose, onConfirm }: {
  source: { file: File; url: string };
  busy: boolean;
  progress: number;
  error: string | null;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const pending = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [crop, setCrop] = useState<PercentCrop>({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  const processing = busy || preparing;

  async function confirm() {
    if (pending.current || busy || !ready) return;
    pending.current = true;
    setPreparing(true);
    setLocalError(null);
    try {
      const image = imageRef.current;
      if (!image || !crop.width || !crop.height) throw new Error("Select the area you want to scan.");
      const sx = image.naturalWidth * crop.x / 100;
      const sy = image.naturalHeight * crop.y / 100;
      const sw = image.naturalWidth * crop.width / 100;
      const sh = image.naturalHeight * crop.height / 100;
      const scale = Math.min(1, 3000 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare this image.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not crop this image.")), "image/jpeg", quality));
      let blob = await encode(0.95);
      // Leave room for multipart headers below Vercel's 4.5 MB request limit.
      for (const quality of [0.85, 0.75, 0.65]) {
        if (blob.size <= 4_000_000) break;
        blob = await encode(quality);
      }
      if (blob.size > 4_000_000) throw new Error("This crop is too large to upload. Select a smaller section of the page.");
      await onConfirm(new File([blob], "vocabulary-crop.jpg", { type: "image/jpeg" }));
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Could not crop this image.");
    } finally {
      pending.current = false;
      setPreparing(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !pending.current && !busy) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl sm:max-w-md" onCloseAutoFocus={event => { if (busy || pending.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>Drag the edges or corners to select the words you want to scan.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex aspect-[3/4] w-full max-w-[min(100%,40vh)] items-center justify-center overflow-hidden rounded-xl bg-muted" dir="ltr">
          <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} disabled={processing} keepSelection minWidth={12} minHeight={12} className="max-w-full">
            {/* Local blob preview must retain natural dimensions for canvas cropping. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imageRef} src={source.url} alt="Photo to crop for vocabulary extraction" onLoad={() => setReady(true)} onError={() => { setReady(false); setLocalError("This image cannot be opened. Choose a JPEG, PNG, or WebP photo."); }} className="block max-h-[53.33vh] max-w-full" />
          </ReactCrop>
        </div>
        {(localError || error) && <p role="alert" className="text-sm text-destructive">{localError || error}</p>}
        <DialogFooter>
          <Button type="button" variant="primary" size="lg" className="relative w-full overflow-hidden disabled:opacity-100" disabled={processing || !ready || !crop.width || !crop.height} onClick={confirm} aria-busy={processing}>
            {processing && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-emerald-500 transition-[width] duration-200 ease-out" style={{ width: `${progress || 5}%` }} />}
            <span className="relative">{processing ? "Processing..." : "Confirm"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
