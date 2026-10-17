import { RefreshCw } from "lucide-react";
import { Button } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import type { ClaimedActivity } from "@/lib/airtable";
import { textColor, typography } from "@/styles/typography";
import { ActivityList } from "./ActivityList";
import { QuickLinks } from "./QuickLinks";
import { LeaderSummary, VolunteerSummary } from "./SummaryCards";
import type { HoursSummary, PendingCounts } from "./types";

type DashboardViewProps = {
  firstName: string;
  leader: boolean;
  loading: boolean;
  refreshing: boolean;
  pending: PendingCounts | null;
  summary: HoursSummary | null;
  activities: ClaimedActivity[];
  onRefresh: () => void;
};

export function DashboardView({ firstName, leader, loading, refreshing, pending, summary, activities, onRefresh }: DashboardViewProps) {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <header className="flex items-center justify-between gap-4">
          <h1 className={`${typography.pageTitle} ${textColor.primary}`}>{leader ? `Welcome back, ${firstName}!` : `Hello, ${firstName}!`}</h1>
          <Button type="button" variant="outline" size="sm" className={typography.buttonSecondary} onClick={onRefresh} disabled={refreshing || loading}>
            Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </header>
        {leader ? <LeaderSummary loading={loading} pending={pending} /> : <><VolunteerSummary loading={loading} summary={summary} activityCount={activities.length} /><ActivityList loading={loading} activities={activities} /></>}
        <QuickLinks leader={leader} />
      </div>
    </AppShell>
  );
}
