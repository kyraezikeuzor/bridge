"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Zap } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { CLAIM_ACTIVITIES_URL } from "@/data/session";
import type { ClaimedActivity } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";
import { textColor, typography } from "@/styles/typography";

export default function ActivitiesPage() {
  const { status: sessionStatus } = useSession();
  const [loadError, setLoadError] = useState("");
  const { data, loading, refreshing, refresh } = useCachedResource<ClaimedActivity[]>(
    "my-activities",
    async () => {
      const res = await fetch("/api/person-activities");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load activities");
      return (body.activities ?? []) as ClaimedActivity[];
    },
    { enabled: sessionStatus === "authenticated", onError: () => setLoadError("We couldn't load your activities. Please refresh to try again."), onSuccess: () => setLoadError("") }
  );
  const claims = useMemo(() => data ?? [], [data]);
  const inProgress = claims.filter((claim) => claim.completionState !== "Completed");
  const completed = claims.filter((claim) => claim.completionState === "Completed");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className={`${typography.pageTitle} ${textColor.primary}`}>
              My Activities
            </h1>
            <p className={`mt-2 ${typography.body} ${textColor.secondary}`}>
              Your claimed volunteer work, all in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setLoadError(""); void refresh(); }}
            disabled={loading || refreshing}
            className={`inline-flex h-9 items-center rounded-md px-3 ${typography.button} ${typography.buttonSecondary} disabled:opacity-60`}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <section className="max-w-4xl space-y-3" aria-live="polite">
          {loadError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">{loadError}</p>}
          {loading || sessionStatus === "loading" ? (
            <div className="space-y-3">
              <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
            </div>
          ) : claims.length === 0 && loadError ? null : claims.length === 0 ? (
            <Card variant="outline" className="border-2 border-dashed">
              <CardContent className={`p-0 ${typography.bodySmall} ${textColor.secondary}`}>
                You have not claimed any activities yet. Browse the board to find a task.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-7">
              <ActivityGroup
                title="In progress"
                description=""
                claims={inProgress}
                empty="No activities are currently in progress."
              />
              {completed.length > 0 && <ActivityGroup
                title="Completed"
                description="Activities with approved work. You can open one to submit another batch."
                claims={completed}
                empty=""
              />}
            </div>
          )}
        </section>

        <div className="w-full"><BrowseActivitiesCard /></div>

      </div>
    </AppShell>
  );
}

function ActivityGroup({ title, description, claims, empty }: { title: string; description: string; claims: ClaimedActivity[]; empty: string }) {
  const isInProgress = title === "In progress";
  return <section><div className="mb-3"><h2 className={`${typography.sectionTitle} ${textColor.primary}`}>{title} <span className={`${typography.metadata} ${textColor.secondary}`}>· {claims.length}</span></h2>{description && <p className={`mt-1 ${typography.bodySmall} ${textColor.secondary}`}>{description}</p>}</div>{claims.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{claims.map((claim) => <ActivityCard key={claim.id} claim={claim} quiet={!isInProgress} />)}</div> : empty ? <p className={`${typography.bodySmall} ${textColor.secondary}`}>{empty}</p> : null}</section>;
}

type ActivityState = { text: string };

function ActivityCard({ claim, quiet }: { claim: ClaimedActivity; quiet: boolean }) {
  const activity = claim.activity;
  const deadline = activity?.endDate ? getDeadlineStatus(activity.endDate) : null;
  const metadata = [activity?.completionWorkflow === "Letters" ? "3 letters = 1 hour" : activity?.hoursValue != null ? `${activity.hoursValue} hr${activity.hoursValue === 1 ? "" : "s"}` : null].filter(Boolean);
  const state = getActivityState(claim);
  const actionLabel = claim.completionState === "Completed" ? "Submit another batch" : "Open activity";

  return <Card variant="outline" className={`relative flex min-h-48 h-full border !p-4 transition-colors hover:border-[#9A9A9A] hover:bg-muted/50 ${quiet ? "bg-muted/20" : ""}`}><Link href={`/activities/${encodeURIComponent(claim.id)}`} aria-label={`Open ${activity?.name || "activity"}`} className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" /><CardContent className="pointer-events-none relative z-10 flex h-full flex-1 flex-col p-0"><div className="min-w-0"><p className={`line-clamp-2 min-h-[2.5rem] ${typography.cardTitle} ${textColor.card}`}>{activity?.name || "Activity details unavailable"}</p>{state ? <p className={`mt-2 min-h-6 ${typography.body} font-medium ${textColor.secondary}`}>{state.text}</p> : <div className="mt-2 h-6 w-36 animate-pulse rounded bg-muted" />}</div><div className="mt-auto"><p className={`min-h-4 ${typography.helper} ${textColor.secondary}`}>{metadata.join(" · ")}{deadline && <>{metadata.length > 0 && <span> · </span>}<span className={deadline.isDue ? "font-medium text-red-500" : textColor.secondary}>Due {deadline.date}</span></>}</p><Link href={`/activities/${encodeURIComponent(claim.id)}`} aria-label={`${actionLabel}: ${activity?.name || "activity"}`} className={`pointer-events-auto mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md px-3 ${typography.button} ${quiet ? typography.buttonActionQuiet : typography.buttonPrimary}`}>{actionLabel}</Link></div></CardContent></Card>;
}

function BrowseActivitiesCard() {
  return <Card variant="outline" className="border-2"><CardContent className="flex items-center gap-5 p-0"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500 shadow-sm shadow-violet-300"><Zap className="h-5 w-5 text-primary-foreground" /></div><div className="min-w-0 flex-1"><p className={`${typography.cardTitle} ${textColor.primary}`}>Browse new activities</p><p className={`mt-0.5 ${typography.metadata} ${textColor.secondary}`}>Open the Volunteer Activities Board to claim a task.</p></div><a href={CLAIM_ACTIVITIES_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 ${typography.button} ${typography.buttonSecondary} transition-colors`}>Open board</a></CardContent></Card>;
}

function getActivityState(claim: ClaimedActivity): ActivityState | null {
  const activity = claim.activity;
  if (!activity) return { text: claim.completionState };
  if (activity.type === "Attendance") {
    if (claim.completionState === "Completed") return { text: "Attendance confirmed" };
    if (claim.completionState === "Submitted") return { text: "Attendance pending" };
    return { text: "Registered" };
  }
  return { text: claim.completionState === "Submitted" ? "Submitted for review" : claim.completionState };
}

function getDeadlineStatus(value: string) {
  const deadline = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const today = new Date();
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((deadline.getTime() - startOfToday) / 86_400_000);
  const date = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return { date, isDue: days <= 0 };
}
