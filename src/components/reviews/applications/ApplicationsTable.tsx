import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@omelora/sunrise";
import type { ReviewDecision } from "@/components/ReviewConfirmPanel";
import type { Application } from "@/lib/airtable";
import { ApplicationStatus } from "./ApplicationStatus";

type ApplicationsTableProps = {
  loading: boolean;
  rows: Application[];
  onOpen: (id: string, decision?: ReviewDecision) => void;
};

export function ApplicationsTable({ loading, rows, onOpen }: ApplicationsTableProps) {
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
    return <p className="py-8 text-center text-muted-foreground">No applications found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">Email</th>
            <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Track</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((application) => (
            <tr key={application.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                <button type="button" className="text-left hover:underline" onClick={() => onOpen(application.id)}>
                  {application.name || "—"}
                </button>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{application.email || "—"}</td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{application.track || "—"}</td>
              <td className="px-4 py-3"><ApplicationStatus status={application.status} /></td>
              <td className="px-4 py-3">
                {application.status === "Submitted" ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="primary" size="sm" className="gap-1.5 !bg-[#09b5ff] !text-white hover:!opacity-90" onClick={() => onOpen(application.id, "approve")}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onOpen(application.id, "reject")}>
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
