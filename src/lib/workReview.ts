/** Pure work/review rules shared by the viewer, completion state, and tests. */
export type WorkReviewState = "In progress" | "Submitted" | "Completed";

export function completionStateFromHours(claimStatus: string, hours: readonly { status: string }[]): WorkReviewState {
  if (hours.some((row) => row.status === "Submitted")) return "Submitted";
  if (hours.some((row) => row.status === "Approved")) return "Completed";
  // Keep historical manual completions only when there is no reviewed work.
  if (!hours.length && claimStatus === "Completed") return "Completed";
  return "In progress";
}

export function hoursBelongsToClaim(
  row: { claimId: string | null; linkedActivityIds: string[] },
  claim: { id: string; activityId: string | null; isLegacySignUp: boolean }
) {
  return claim.isLegacySignUp
    ? !row.claimId && Boolean(claim.activityId && row.linkedActivityIds.includes(claim.activityId))
    : row.claimId === claim.id;
}

export function nextWorkReference(claimId: string, hours: readonly { id: string; status: string; submittedAt: string }[]) {
  const rejected = hours.filter((row) => row.status === "Rejected")
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id))[0];
  return `Bridge:${claimId}:${rejected?.id ?? "initial"}`;
}

export function submissionValidationError(
  target: number | null,
  format: string | null,
  submissions: readonly { content: string | null; files: readonly unknown[] }[]
): string | null {
  if (!submissions.length || (target && submissions.length !== target)) {
    return target
      ? `Save all ${target} required submissions before requesting hours. You have saved ${submissions.length} of ${target}.`
      : "Save at least one submission before requesting hours.";
  }
  if (format !== "Text" && format !== "File") return "This activity needs a submission format before work can be submitted.";
  if (submissions.some((submission) => format === "Text"
    ? !submission.content?.trim() || submission.files.length > 0
    : submission.files.length === 0 || Boolean(submission.content?.trim()))) {
    return `Every saved submission must contain the required ${format === "Text" ? "text" : "PDF file"}.`;
  }
  return null;
}
