"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import { ActivitiesTable } from "@/components/reviews/activities/ActivitiesTable";
import { ActivityDialog } from "@/components/reviews/activities/ActivityDialog";
import { DiscordDialog } from "@/components/reviews/activities/DiscordDialog";
import { toReviewActivity } from "@/components/reviews/activities/activity";
import type { ReviewActivity } from "@/components/reviews/activities/types";
import type { Activity } from "@/lib/airtable";
import type { ReviewActivityStatus } from "@/lib/leader-types";
import { useCachedResource } from "@/lib/useCachedResource";

const TABS: ReviewActivityStatus[] = ["Submitted", "Active", "Closed"];

export default function ReviewActivitiesPage() {
  const { push: toast } = useToast();
  const [tab, setTab] = useState<ReviewActivityStatus>("Active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discordActivity, setDiscordActivity] = useState<ReviewActivity | null>(null);
  const { data, setData, loading, refreshing, refresh } =
    useCachedResource<ReviewActivity[]>(
      "activities",
      async () => {
        const response = await fetch("/api/activities");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to load activities");
        return (body.activities as Activity[]).reduce<ReviewActivity[]>((result, activity) => {
          const reviewActivity = toReviewActivity(activity);
          if (reviewActivity) result.push(reviewActivity);
          return result;
        }, []);
      },
      {
        onError: (error) =>
          toast(error instanceof Error ? error.message : "Failed to load activities", "error"),
      }
    );

  const activities = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => activities.filter((activity) => activity.status === tab), [activities, tab]);
  const selected = selectedId ? activities.find((activity) => activity.id === selectedId) ?? null : null;

  const handleRefresh = async () => {
    await fetch("/api/refresh-activities-cache", { method: "POST" }).catch(() => undefined);
    await refresh();
  };

  const handleStatusChange = async (id: string, status: ReviewActivityStatus) => {
    const previous = activities.find((activity) => activity.id === id);
    setData((current) => current.map((activity) => (activity.id === id ? { ...activity, status } : activity)));
    setSelectedId(null);
    try {
      const response = await fetch("/api/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: id, status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to update activity");
      toast("Activity status updated");
    } catch (error) {
      if (previous) {
        setData((current) => current.map((activity) => (activity.id === id ? previous : activity)));
      }
      toast(error instanceof Error ? error.message : "Failed to update activity", "error");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <header className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">Review Activities</h1>
            <p className="mt-1 text-[#747474]">Approve, reject, and manage volunteer activities</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/create-activity"><Button type="button" variant="primary" size="sm">Create Activity</Button></Link>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing || loading}>
              Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-5 sm:px-8">
        <div className="mb-5 flex rounded-lg bg-muted p-1 sm:w-80">
          {TABS.map((status) => (
            <button key={status} type="button" onClick={() => setTab(status)} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === status ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {status}
            </button>
          ))}
        </div>
        <ActivitiesTable loading={loading} rows={filtered} emptyStatus={tab} onOpen={setSelectedId} onStatusChange={(id, status) => void handleStatusChange(id, status)} />
      </main>

      {selected ? (
        <ActivityDialog activity={selected} onClose={() => setSelectedId(null)} onDiscord={() => setDiscordActivity(selected)} onStatusChange={(status) => void handleStatusChange(selected.id, status)} />
      ) : null}
      {discordActivity ? <DiscordDialog activity={discordActivity} onClose={() => setDiscordActivity(null)} /> : null}
    </div>
  );
}
