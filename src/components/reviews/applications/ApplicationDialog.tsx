import { CheckCircle2, MessageSquareReply, XCircle } from "lucide-react";
import { Badge, Button } from "@omelora/sunrise";
import { ReviewConfirmPanel, type ReviewDecision } from "@/components/ReviewConfirmPanel";
import type { Application } from "@/lib/airtable";
import { DetailField } from "../shared/DetailField";
import { ReviewDialog } from "../shared/ReviewDialog";
import { ApplicationStatus } from "./ApplicationStatus";

type ApplicationDialogProps = {
  application: Application;
  decision: ReviewDecision | null;
  replyOpen: boolean;
  reply: string;
  onDecisionChange: (decision: ReviewDecision | null) => void;
  onReplyOpenChange: (open: boolean) => void;
  onReplyChange: (reply: string) => void;
  onConfirm: (choice: string, note: string) => void;
  onClose: () => void;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

export function ApplicationDialog({
  application,
  decision,
  replyOpen,
  reply,
  onDecisionChange,
  onReplyOpenChange,
  onReplyChange,
  onConfirm,
  onClose,
}: ApplicationDialogProps) {
  const footer = application.status !== "Submitted" ? null : decision ? (
    <ReviewConfirmPanel key={decision} decision={decision} onCancel={() => onDecisionChange(null)} onConfirm={onConfirm} />
  ) : (
    <div className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
      <Button type="button" variant="destructive" size="lg" className="w-full gap-2" onClick={() => onDecisionChange("reject")}>
        <XCircle className="h-5 w-5" /> Reject
      </Button>
      <Button type="button" variant="primary" size="lg" className="w-full gap-2 !bg-[#09b5ff] !text-white hover:!opacity-90" onClick={() => onDecisionChange("approve")}>
        <CheckCircle2 className="h-5 w-5" /> Approve
      </Button>
    </div>
  );

  return (
    <ReviewDialog
      title={application.name || "Applicant"}
      badges={<><ApplicationStatus status={application.status} /><Badge variant="default">{application.role || "Volunteer"}</Badge></>}
      footer={footer}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailField label="Email" value={application.email} />
        <DetailField label="Track" value={application.track} />
        <div className="flex items-end gap-4">
          <DetailField label="Birthday" value={formatBirthday(application.birthday)} />
          <DetailField label="Age" value={application.age} emphasize />
        </div>
        <DetailField label="School" value={application.school} />
        <DetailField label="State" value={application.state} />
        <DetailField label="Country" value={application.country} />
        <DetailField label="Languages" value={application.languages.join(", ") || null} />
        <DetailField label="Discovery" value={application.discovery} />
      </div>

      {application.interestStatement ? (
        <section className="mt-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Interest Statement</p>
          <p className="text-sm leading-relaxed text-foreground">{application.interestStatement}</p>
        </section>
      ) : null}

      {application.comments ? (
        <section className="mt-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comments</p>
          <p className="text-sm leading-relaxed text-foreground">{application.comments}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" onClick={() => onReplyOpenChange(!replyOpen)}>
            <MessageSquareReply className="h-4 w-4" /> Reply to Comment
          </Button>
          {replyOpen ? (
            <div className="mt-3 space-y-2">
              <label htmlFor="application-reply" className="text-xs font-medium text-muted-foreground">Reply to applicant</label>
              <textarea id="application-reply" value={reply} onChange={(event) => onReplyChange(event.target.value)} placeholder="Type your reply..." rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09b5ff]" />
              <p className="text-xs text-muted-foreground">Sent to the applicant with your decision.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </ReviewDialog>
  );
}
