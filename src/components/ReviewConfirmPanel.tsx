"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquarePlus, XCircle } from "lucide-react";

export const APPROVE_RATINGS = [
  "Great",
  "Good",
  "Adequate",
  "Needs Follow-up",
] as const;

/** Reject reasons for volunteer applications. */
export const REJECT_REASONS = [
  "Age Requirement Not Met",
  "Interest Statement Insufficient",
  "Incomplete Application",
  "Suspicious / Inconsistent Submission",
  "Other",
] as const;

/** Reject reasons for hours requests. */
export const HOURS_REJECT_REASONS = [
  "Insufficient Proof",
  "Hours Don't Match Activity",
  "Activity Not Completed",
  "No Activity Listed",
  "Duplicate Submission",
  "Other",
] as const;

export type ApproveRating = (typeof APPROVE_RATINGS)[number];
export type RejectReason = (typeof REJECT_REASONS)[number];

export type ReviewDecision = "approve" | "reject";

type ReviewConfirmPanelProps = {
  decision: ReviewDecision;
  onCancel: () => void;
  onConfirm: (choice: string, note: string) => void;
  /** Defaults to the application reasons; hours pass their own set. */
  rejectOptions?: readonly string[];
  approveOptions?: readonly string[];
};

export function ReviewConfirmPanel({
  decision,
  onCancel,
  onConfirm,
  rejectOptions = REJECT_REASONS,
  approveOptions = APPROVE_RATINGS,
}: ReviewConfirmPanelProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const isApprove = decision === "approve";

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="mb-4 flex items-center gap-2.5">
        {isApprove ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
          </span>
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500 text-white">
            <XCircle className="h-4 w-4" strokeWidth={2.5} />
          </span>
        )}
        <p className="text-sm font-semibold text-foreground">
          {isApprove
            ? "Approving — select a rating to confirm:"
            : "Rejecting — select a reason to confirm:"}
        </p>
      </div>

      {isApprove ? (
        <div className="grid grid-cols-2 gap-2.5">
          {approveOptions.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onConfirm(rating, note.trim())}
              className="rounded-md border border-border bg-background px-4 py-3.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
            >
              {rating}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rejectOptions.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => onConfirm(reason, note.trim())}
              className="rounded-full border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-red-400 hover:bg-red-50"
            >
              {reason}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {noteOpen ? (
          <div className="space-y-2">
            <label
              htmlFor="review-note"
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Add a note (optional)
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional note for this review…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Add a note (optional)
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
