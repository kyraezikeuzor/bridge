"use client";

import { useSession } from "next-auth/react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { DashboardData } from "@/components/dashboard/types";
import { isLeaderRole } from "@/lib/roles";
import type { ClaimedActivity } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Dashboard request failed");
  return body;
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const firstName = session?.user?.firstName || "there";
  const personId = session?.user?.personId || "";
  const leader = isLeaderRole(session?.user?.role);
  const { data, loading, refreshing, refresh } = useCachedResource<DashboardData>(
    `dashboard:${leader ? "director" : `volunteer:${personId}`}`,
    async () => {
      if (leader) {
        const body = await readJson(await fetch("/api/pending-review-counts"));
        return {
          pending: {
            applications: body.applications ?? 0,
            hours: body.hours ?? 0,
            activitiesInProgress: body.activitiesInProgress ?? 0,
          },
          hoursSummary: null,
          claimed: [],
        };
      }
      if (!personId) {
        return {
          pending: null,
          hoursSummary: { approvedThisMonth: 0, pendingReview: 0, lifetimeTotal: 0 },
          claimed: [],
        };
      }

      const body = await readJson(await fetch("/api/dashboard"));
      return {
        pending: null,
        hoursSummary: {
          approvedThisMonth: body.hoursSummary?.approvedThisMonth ?? 0,
          pendingReview: body.hoursSummary?.pendingReview ?? 0,
          lifetimeTotal: body.hoursSummary?.lifetimeTotal ?? 0,
        },
        claimed: (body.activities ?? []) as ClaimedActivity[],
      };
    },
    {
      enabled: sessionStatus !== "loading",
      onError: (error) => console.error("[dashboard]", error),
    }
  );

  const handleRefresh = async () => {
    // Volunteers' own changes clear the cache as they happen; only directors force a reload.
    const endpoints = leader
      ? ["/api/refresh-applications-cache", "/api/refresh-hours-cache"]
      : [];
    await Promise.all(endpoints.map((endpoint) => fetch(endpoint, { method: "POST" }))).catch(() => undefined);
    await refresh();
  };

  return (
    <DashboardView
      firstName={firstName}
      leader={leader}
      loading={loading}
      refreshing={refreshing}
      pending={data?.pending ?? null}
      summary={data?.hoursSummary ?? null}
      activities={data?.claimed ?? []}
      onRefresh={() => void handleRefresh()}
    />
  );
}
