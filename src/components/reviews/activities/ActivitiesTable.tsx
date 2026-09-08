import { Archive, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@omelora/sunrise";
import type { ReviewActivityStatus } from "@/lib/leader-types";
import { formatActivityDate } from "./activity";
import { ActivityStatus } from "./ActivityStatus";
import type { ReviewActivity } from "./types";

type ActivitiesTableProps = {
  loading: boolean;
  rows: ReviewActivity[];
  emptyStatus: ReviewActivityStatus;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: ReviewActivityStatus) => void;
};

export function ActivitiesTable({ loading, rows, emptyStatus, onOpen, onStatusChange }: ActivitiesTableProps) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No {emptyStatus.toLowerCase()} activities found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Activity</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">Track</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Type</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Hours</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Spots</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Dates</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((activity) => (
            <tr key={activity.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
              <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">
                <button type="button" className="max-w-full truncate text-left hover:underline" onClick={() => onOpen(activity.id)}>{activity.activityName}</button>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{activity.track}</td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{activity.type}</td>
              <td className="px-4 py-3 text-foreground">{activity.hoursValue}</td>
              <td className="hidden px-4 py-3 text-foreground lg:table-cell">{activity.spotsAvailable}</td>
              <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">{formatActivityDate(activity.startDate)} – {formatActivityDate(activity.endDate)}</td>
              <td className="px-4 py-3"><ActivityStatus status={activity.status} /></td>
              <td className="px-4 py-3">
                {activity.status === "Submitted" ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="primary" size="sm" className="gap-1.5 !bg-[#0584C5] !text-[#E2F4FE] hover:!opacity-90" onClick={() => onStatusChange(activity.id, "Active")}>
                      <CheckCircle className="h-4 w-4" /> Approve
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange(activity.id, "Closed")}>
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                ) : activity.status === "Active" ? (
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onStatusChange(activity.id, "Closed")}>
                    <Archive className="h-4 w-4" /> Close
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
