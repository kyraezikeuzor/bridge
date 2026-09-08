import type { ClaimedActivity } from "@/lib/airtable";

export type PendingCounts = {
  applications: number;
  hours: number;
  activitiesInProgress: number;
};

export type HoursSummary = {
  approvedThisMonth: number;
  pendingReview: number;
  lifetimeTotal: number;
};

export type DashboardData = {
  pending: PendingCounts | null;
  hoursSummary: HoursSummary | null;
  claimed: ClaimedActivity[];
};
