"use client";

import { Paperclip, X } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { textColor, typography } from "@/styles/typography";

type AttachmentFileUploaderProps = {
  file: File | null;
  onChange: (file: File | null) => void;
};

/** Shadcn-style single attachment control for the PDF submission workflow. */
export function AttachmentFileUploader({ file, onChange }: AttachmentFileUploaderProps) {
  return (
    <div className="mt-4">
      <span className={`block ${typography.label}`}>PDF attachment</span>
      {file ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <span className={`flex min-w-0 items-center gap-2 ${typography.metadata} ${textColor.primary}`}><Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{file.name}</span></span>
          <Button type="button" variant="ghost" size="sm" aria-label="Remove attachment" onClick={() => onChange(null)}><X className="h-4 w-4" /></Button>
        </div>
      ) : <Input type="file" accept="application/pdf,.pdf" onChange={(event) => onChange(event.target.files?.[0] || null)} className={`mt-1.5 ${typography.metadata}`} />}
    </div>
  );
}
