import { ClipboardList } from "lucide-react";
import { Badge, Card, CardContent } from "@omelora/sunrise";
import type { HoursRequest } from "@/lib/airtable";
import { formatDate } from "./format";

function HoursStatus({ status }: { status: string }) {
  if (status === "Approved") return <Badge variant="success">Approved</Badge>;
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}

export function HoursTable({ loading, rows, hasRecords }: { loading: boolean; rows: HoursRequest[]; hasRecords: boolean }) {
  let content;
  if (loading) {
    content = <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60" />)}</div>;
  } else if (rows.length === 0) {
    content = <div className="flex flex-col items-center justify-center gap-3 py-16 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><ClipboardList className="h-5 w-5 text-muted-foreground" /></div><p className="text-sm text-muted-foreground">{hasRecords ? "No hours match your search" : "No hours recorded yet"}</p></div>;
  } else {
    content = <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-muted/40 text-left"><th className="px-4 py-3 font-medium text-muted-foreground">Dates</th><th className="px-4 py-3 font-medium text-muted-foreground">Activity</th><th className="px-4 py-3 font-medium text-muted-foreground">Hours</th><th className="px-4 py-3 font-medium text-muted-foreground">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border last:border-0"><td className="whitespace-nowrap px-4 py-3 text-foreground">{row.dateLabel || formatDate(row.date)}</td><td className="px-4 py-3 text-foreground">{row.activityName}</td><td className="px-4 py-3 text-foreground">{row.hoursRequested ?? "—"}</td><td className="px-4 py-3"><HoursStatus status={row.status} /></td></tr>)}</tbody></table></div>;
  }
  return <Card variant="outline" className="border !p-1.5 sm:!p-2"><CardContent className="p-0">{content}</CardContent></Card>;
}
