"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw, X } from "lucide-react";
import { ActivityBody } from "@/components/activity/ActivityBody";
import type { ClaimedActivity, HoursRequest } from "@/lib/airtable";
import { clearResourceCache, getCachedResource, useCachedResource } from "@/lib/useCachedResource";
import { typography } from "@/styles/typography";

type ActivityResponse = { claim: ClaimedActivity; hours: HoursRequest[] };

export default function ActivityViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const manualRefreshRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [recentHoursByClaim, setRecentHoursByClaim] = useState<Record<string, HoursRequest[]>>({});
  const claimId = typeof slug === "string" ? slug : "";
  const cachedClaim = getCachedResource<ClaimedActivity[]>("my-activities")?.find((item) => item.id === claimId);
  const { data, setData, loading, refreshing, refresh } = useCachedResource<ActivityResponse>(
    `my-activity:${claimId}`,
    async () => {
      const response = await fetch(`/api/person-activities/${encodeURIComponent(claimId)}`);
      if (!response.ok) throw new Error("Failed to load activity");
      return (await response.json()) as ActivityResponse;
    },
    {
      enabled: sessionStatus === "authenticated" && Boolean(claimId),
      onError: () => {
        manualRefreshRef.current = false;
        setLoadError("We couldn't load this activity. Your draft is safe; try refreshing.");
      },
      onSuccess: () => {
        setLoadError("");
        if (manualRefreshRef.current) {
          manualRefreshRef.current = false;
          setRecentHoursByClaim((previous) => ({ ...previous, [claimId]: [] }));
        }
      },
    }
  );
  const closeWorkspace = useCallback(() => router.push("/activities"), [router]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeWorkspace(); };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLElement>("button, [href], input, textarea")?.focus());
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeWorkspace]);
  const handleSubmitted = (hours: HoursRequest) => {
    setRecentHoursByClaim((previous) => ({ ...previous, [claimId]: [hours, ...(previous[claimId] ?? []).filter((row) => row.id !== hours.id)] }));
    setData((previous) => previous ? { ...previous, hours: [hours, ...previous.hours.filter((row) => row.id !== hours.id)] } : { claim: (data?.claim || cachedClaim)!, hours: [hours] });
    clearResourceCache("my-activities");
    const personId = session?.user?.personId;
    if (personId) {
      clearResourceCache(`person-hours:${personId}`);
      clearResourceCache(`dashboard:volunteer:${personId}`);
    }
  };
  const recentHours = recentHoursByClaim[claimId] ?? [];
  const visibleHours = [...recentHours, ...(data?.hours ?? []).filter((row) => !recentHours.some((recent) => recent.id === row.id))];

  return <main className="min-h-screen bg-muted/50 px-3 py-4 sm:px-6 sm:py-10">
    <div ref={workspaceRef} className="mx-auto w-full max-w-[760px] rounded-xl border-2 border-border bg-background p-5 shadow-sm sm:p-8">
      <div className="mb-7 flex items-center justify-between gap-4">
        <button type="button" onClick={closeWorkspace} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 ${typography.button} hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary`}><X className="h-4 w-4" />Close</button>
        <button type="button" onClick={() => { manualRefreshRef.current = true; setLoadError(""); void refresh(); }} disabled={loading || refreshing} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 ${typography.button} hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary`}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      {loadError && <p role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">{loadError}</p>}
      <ActivityBody key={claimId} claim={data?.claim || cachedClaim} hours={visibleHours} loading={(loading || sessionStatus === "loading") && !cachedClaim} onSubmitted={handleSubmitted} />
      {loading && cachedClaim && <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">Loading your submission history…</p>}
    </div>
  </main>;
}
