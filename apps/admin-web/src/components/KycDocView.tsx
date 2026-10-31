"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

function kindOf(blobUrl: string) {
  const value = blobUrl.toLowerCase();
  if (value.startsWith("data:application/pdf") || value.includes("application/pdf") || value.includes(".pdf")) return "pdf";
  if (value.startsWith("data:image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)) return "image";
  return "file";
}

export function KycDocView({
  blobUrl,
  title,
  preview = true,
}: {
  blobUrl?: string;
  title: string;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!blobUrl) return <span className="text-xs text-text-muted">No file on record</span>;
  const kind = kindOf(blobUrl);

  return (
    <div>
      {preview && kind === "image" && (
        <button type="button" className="block" onClick={() => setOpen(true)}>
          <img src={blobUrl} alt={title} className="mt-2 max-h-40 max-w-full rounded-lg border border-border object-contain" />
        </button>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => setOpen(true)}>
          View document
        </Button>
        <a className="inline-flex items-center text-xs font-semibold text-brand" href={blobUrl} download={`${title.replace(/\s+/g, "-").toLowerCase()}`}>
          Download
        </a>
      </div>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-semibold text-text-primary">{title}</p>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
            </div>
            {kind === "image" ? (
              <img src={blobUrl} alt={title} className="mx-auto max-h-[75vh] max-w-full object-contain" />
            ) : (
              <iframe title={title} src={blobUrl} className="h-[75vh] w-full rounded-lg border border-border bg-surface" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
