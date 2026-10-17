import { Activity, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { textColor, typography } from "@/styles/typography";
import type { HoursSummary, PendingCounts } from "./types";

function Skeleton({ rows }: { rows: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-5 animate-pulse rounded bg-muted/70" />)}</div>;
}

export function LeaderSummary({ loading, pending }: { loading: boolean; pending: PendingCounts | null }) {
  return (
    <Card variant="outline" className="border-2"><CardContent className="p-0">
      <div className="mb-4 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary"><ClipboardCheck className="h-4 w-4 text-primary-foreground" /></div><h2 className={`${typography.sectionTitle} ${textColor.primary}`}>Pending Your Review</h2></div>
      {loading || !pending ? <Skeleton rows={3} /> : <div className="space-y-2 text-base font-medium text-muted-foreground">
        <p><strong className="text-[#3F3F3F]">{pending.applications}</strong> application{pending.applications !== 1 ? "s" : ""} awaiting review</p>
        <p><strong className="text-[#3F3F3F]">{pending.hours}</strong> hour{pending.hours !== 1 ? "s" : ""} awaiting approval</p>
        <p><strong className="text-[#3F3F3F]">{pending.activitiesInProgress}</strong> activit{pending.activitiesInProgress !== 1 ? "ies" : "y"} in progress</p>
      </div>}
    </CardContent></Card>
  );
}

export function VolunteerSummary({ loading, summary, activityCount }: { loading: boolean; summary: HoursSummary | null; activityCount: number }) {
  return (
    <Card variant="outline" className="border-2"><CardContent className="p-0">
      <div className="mb-4 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500"><Activity className="h-4 w-4 text-primary-foreground" /></div><h2 className={`${typography.sectionTitle} ${textColor.primary}`}>Your Activity</h2></div>
      {loading || !summary ? <Skeleton rows={4} /> : <div className="space-y-2 text-base font-medium text-muted-foreground">
        <p><strong className="text-foreground">{summary.approvedThisMonth}</strong> hours approved this month</p>
        <p><strong className="text-foreground">{summary.pendingReview}</strong> submission{summary.pendingReview !== 1 ? "s" : ""} pending review</p>
        <p><strong className="text-foreground">{summary.lifetimeTotal}</strong> lifetime hours approved</p>
        <p><strong className="text-foreground">{activityCount}</strong> activit{activityCount === 1 ? "y" : "ies"} signed up</p>
      </div>}
    </CardContent></Card>
  );
}
