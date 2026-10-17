import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Paperclip, XCircle } from "lucide-react";
import { Badge, Button } from "@omelora/sunrise";
import { HOURS_REJECT_REASONS, ReviewConfirmPanel, type ReviewDecision } from "@/components/ReviewConfirmPanel";
import type { HoursRequest } from "@/lib/airtable";
import { DetailField } from "../shared/DetailField";
import { ReviewDialog } from "../shared/ReviewDialog";
import { HoursStatus } from "./HoursStatus";
import { SubmissionContent } from "./SubmissionContent";

type HoursDialogProps = {
  row: HoursRequest;
  decision: ReviewDecision | null;
  hours: string;
  onHoursChange: (value: string) => void;
  onDecisionChange: (decision: ReviewDecision | null) => void;
  onConfirm: (choice: string, note: string) => void;
  onClose: () => void;
};

function yesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Yes" : "No";
}

function Submissions({ row }: { row: HoursRequest }) {
  if (row.submissions.length === 0) return null;

  return (
    <section className="mt-6 border-t border-border pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> Submissions ({row.submissions.length})
      </p>
      <div className="space-y-2">
        {row.submissions.map((submission) => (
          <article key={submission.id} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{submission.activityName || "Submission"}</p>
              {submission.category ? <Badge variant="outline">{submission.category}</Badge> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="warning">{submission.status}</Badge>
              {submission.submittedDate ? <span className="text-sm text-muted-foreground">{submission.submittedDate}</span> : null}
            </div>
            {submission.files.map((file) => (
              <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{file.filename}</span>
              </a>
            ))}
            {submission.content ? <SubmissionContent content={submission.content} /> : null}
            {submission.files.length === 0 && !submission.content ? (
              <p className="mt-2 text-sm italic text-muted-foreground">No file or text submitted</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function LinkedActivity({ row }: { row: HoursRequest }) {
  const activity = row.linkedActivity;
  if (!activity) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Activity</p>
      <p className="font-semibold text-foreground">{activity.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {[activity.track, activity.hoursValue ? `${activity.hoursValue} hrs` : null].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <DetailField label="Track" value={activity.track} />
        <DetailField label="Hours Value" value={activity.hoursValue || null} />
      </div>
    </section>
  );
}

export function HoursDialog({
  row,
  decision,
  hours,
  onHoursChange,
  onDecisionChange,
  onConfirm,
  onClose,
}: HoursDialogProps) {
  const isSubmitted = row.status === "Submitted";
  const footer = !isSubmitted ? null : decision ? (
    <ReviewConfirmPanel
      key={decision}
      decision={decision}
      rejectOptions={HOURS_REJECT_REASONS}
      onCancel={() => onDecisionChange(null)}
      onConfirm={onConfirm}
    />
  ) : (
    <div className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
      <Button type="button" variant="destructive" size="lg" className="w-full gap-2" onClick={() => onDecisionChange("reject")}>
        <XCircle className="h-5 w-5" /> Reject
      </Button>
      <Button type="button" variant="primary" size="lg" className="w-full gap-2" onClick={() => onDecisionChange("approve")}>
        <CheckCircle2 className="h-5 w-5" /> Approve
      </Button>
    </div>
  );

  return (
    <ReviewDialog
      title={`${row.personName || "Volunteer"} — Hours Request`}
      badges={<><HoursStatus status={row.status} />{row.track ? <Badge variant="outline">{row.track}</Badge> : null}</>}
      footer={footer}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Hours">
          {isSubmitted ? (
            <>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hours}
                onChange={(event) => onHoursChange(event.target.value)}
                aria-label="Hours to award"
                className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-2xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09b5ff]"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {row.linkedActivity?.hoursValue
                  ? `Activity value: ${row.linkedActivity.hoursValue} · Requested: ${row.requestedHours ?? "—"}`
                  : `Requested: ${row.requestedHours ?? "—"}`}
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-foreground">{row.hoursRequested ?? "—"}</p>
          )}
        </DetailField>
        <DetailField label="Date" value={row.dateLabel} />
        {row.status !== "Submitted" ? <DetailField label="Originally Requested" value={row.requestedHours} /> : null}
        {row.quantity != null ? <DetailField label="Quantity" value={row.quantity} /> : null}
        {row.certificateHours != null ? <DetailField label="Certificate Hours" value={row.certificateHours} /> : null}
        {row.verifiedHours != null ? <DetailField label="Externally Verified Hours" value={row.verifiedHours} /> : null}
        <DetailField label="Ownership Agreement" value={yesNo(row.ownershipAgreement)} />
        <DetailField label="Photo Permissions" value={yesNo(row.photoPermissions)} />
        <DetailField label="Proof">
          {row.proofUrl ? (
            <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              View Proof Link <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{row.submissions.length ? "See linked submissions below" : "No proof provided"}</p>
          )}
          {row.proofFiles.map((file) => <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex flex-col gap-1 rounded-lg border border-border p-2 text-sm font-medium text-primary hover:underline"><img src={file.url} alt={file.filename} className="h-24 w-24 rounded-md object-cover" /><span className="max-w-24 truncate">{file.filename}</span></a>)}
        </DetailField>
        {row.description ? <DetailField label="Description" value={row.description} /> : null}
      </div>
      {row.reviewNotes ? <section className="mt-6 border-t border-border pt-4"><DetailField label="Review Notes" value={row.reviewNotes} /></section> : null}

      {row.activitySubmission ? (
        <section className="mt-6 border-t border-border pt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activity Submission</p>
          <p className="break-all text-sm text-foreground">{row.activitySubmission}</p>
        </section>
      ) : null}

      {row.missingRequiredSubmission ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">No submission provided</p>
            <p className="mt-0.5 text-sm text-amber-800">This activity requires the volunteer&apos;s work before its hours can be approved.</p>
          </div>
        </div>
      ) : null}

      <Submissions row={row} />
      <LinkedActivity row={row} />
    </ReviewDialog>
  );
}
