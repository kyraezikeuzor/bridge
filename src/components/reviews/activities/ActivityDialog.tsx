import { Archive, CheckCircle, Copy, XCircle } from "lucide-react";
import { Badge, Button } from "@omelora/sunrise";
import type { ReviewActivityStatus } from "@/lib/leader-types";
import { DetailField } from "../shared/DetailField";
import { ReviewDialog } from "../shared/ReviewDialog";
import { formatActivityDate } from "./activity";
import { ActivityStatus } from "./ActivityStatus";
import type { ReviewActivity } from "./types";

type ActivityDialogProps = {
  activity: ReviewActivity;
  onClose: () => void;
  onDiscord: () => void;
  onStatusChange: (status: ReviewActivityStatus) => void;
};

export function ActivityDialog({ activity, onClose, onDiscord, onStatusChange }: ActivityDialogProps) {
  const statusActions = activity.status === "Submitted" ? (
    <div className="flex gap-2">
      <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={() => onStatusChange("Closed")}>
        <XCircle className="h-4 w-4" /> Reject
      </Button>
      <Button type="button" variant="primary" size="sm" className="gap-1.5 !bg-[#0584C5] !text-[#E2F4FE] hover:!opacity-90" onClick={() => onStatusChange("Active")}>
        <CheckCircle className="h-4 w-4" /> Approve
      </Button>
    </div>
  ) : activity.status === "Active" ? (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange("Closed")}>
      <Archive className="h-4 w-4" /> Close Activity
    </Button>
  ) : null;

  return (
    <ReviewDialog
      title={activity.activityName}
      badges={<><ActivityStatus status={activity.status} /><Badge variant="default" size="sm">{activity.track}</Badge><Badge variant="outline" size="sm">{activity.type}</Badge></>}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onDiscord}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Discord Post</Button>
          {statusActions}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Hours" value={activity.hoursValue} />
        <DetailField label="Spots" value={activity.spotsAvailable} />
        <DetailField label="Dates" value={`${formatActivityDate(activity.startDate)} – ${formatActivityDate(activity.endDate)}`} />
        {activity.languages.length > 0 ? <DetailField label="Languages" value={activity.languages.join(", ")} /> : null}
      </div>
      {activity.description ? (
        <section className="mt-6 border-t border-border pt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{activity.description}</p>
        </section>
      ) : null}
    </ReviewDialog>
  );
}
