import { AlertTriangle, CheckCircle2, Paperclip, XCircle } from "lucide-react";
import { Button } from "@omelora/sunrise";
import type { HoursRequest } from "@/lib/airtable";
import { HoursStatus } from "./HoursStatus";

function truncateUrl(value: string, max = 48): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

type HoursTableProps = {
  loading: boolean;
  rows: HoursRequest[];
  onOpen: (id: string, decision?: "approve" | "reject") => void;
};

export function HoursTable({ loading, rows, onOpen }: HoursTableProps) {
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
    return (
      <p className="py-8 text-center text-muted-foreground">
        No hours requests found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Volunteer</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">Activity</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Hours</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Date</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Track</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-left hover:underline"
                  onClick={() => onOpen(row.id)}
                >
                  {row.personName || "—"}
                  {row.missingRequiredSubmission ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="No submission provided" />
                  ) : row.submissions.length > 0 ? (
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={`${row.submissions.length} submission(s)`} />
                  ) : null}
                </button>
              </td>
              <td className="hidden max-w-[220px] truncate px-4 py-3 text-muted-foreground sm:table-cell">
                {truncateUrl(row.activityName)}
              </td>
              <td className="px-4 py-3 text-foreground">{row.hoursRequested ?? "—"}</td>
              <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">{row.dateLabel || "—"}</td>
              <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{row.track || "—"}</td>
              <td className="px-4 py-3"><HoursStatus status={row.status} /></td>
              <td className="px-4 py-3">
                {row.status === "Submitted" ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="primary" size="sm" className="gap-1.5" onClick={() => onOpen(row.id, "approve")}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onOpen(row.id, "reject")}>
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </div>
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
