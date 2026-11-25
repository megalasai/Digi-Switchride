"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api";

function kindOf(blobUrl: string) {
  const value = blobUrl.toLowerCase();
  if (value.startsWith("data:application/pdf") || value.includes("application/pdf") || value.includes(".pdf")) return "pdf";
  if (value.startsWith("blob:") || value.startsWith("data:image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)) return "image";
  return "file";
}

async function loadProtectedFile(path: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  const tenantId = typeof window !== "undefined" ? localStorage.getItem("adminTenantId") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    },
  });
  if (!res.ok) throw new Error("Could not open KYC file");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function KycDocView({
  blobUrl,
  fileUrl,
  title,
  preview = true,
}: {
  blobUrl?: string;
  fileUrl?: string;
  title: string;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState(blobUrl || "");
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    if (blobUrl) {
      setSrc(blobUrl);
      return;
    }
    if (!fileUrl) {
      setSrc("");
      return;
    }
    loadProtectedFile(fileUrl)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open KYC file"));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blobUrl, fileUrl]);

  if (!blobUrl && !fileUrl) return <span className="text-xs text-text-muted">No file on record</span>;
  if (error) return <span className="text-xs text-text-muted">{error}</span>;
  if (!src) return <span className="text-xs text-text-muted">Loading file…</span>;
  const kind = kindOf(src);

  return (
    <div>
      {preview && kind === "image" && (
        <button type="button" className="block" onClick={() => setOpen(true)}>
          <img src={src} alt={title} className="mt-2 max-h-40 max-w-full rounded-lg border border-border object-contain" />
        </button>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => setOpen(true)}>
          View document
        </Button>
        <a className="inline-flex items-center text-xs font-semibold text-brand" href={src} download={`${title.replace(/\s+/g, "-").toLowerCase()}`}>
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
              <img src={src} alt={title} className="mx-auto max-h-[75vh] max-w-full object-contain" />
            ) : (
              <iframe title={title} src={src} className="h-[75vh] w-full rounded-lg border border-border bg-surface" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
