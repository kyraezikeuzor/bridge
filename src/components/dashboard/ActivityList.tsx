import Link from "next/link";
import type { ClaimedActivity } from "@/lib/airtable";
import { textColor, typography } from "@/styles/typography";

export function ActivityList({ loading, activities }: { loading: boolean; activities: ClaimedActivity[] }) {
  const inProgress = activities.filter((activity) => activity.completionState === "In progress");
  return (
    <section className="rounded-xl border-2 border-border bg-background p-4 sm:p-5">
      <div className="mb-3">
        <h3 className={`${typography.status} uppercase ${textColor.secondary}`}>My Activities</h3>
      </div>
      {loading ? <div className="space-y-2"><div className="h-16 animate-pulse rounded bg-muted/70" /><div className="h-16 animate-pulse rounded bg-muted/70" /></div> : inProgress.length === 0 ? (
        <p className={`${typography.bodySmall} ${textColor.secondary}`}>You have no activities in progress right now.</p>
      ) : (
        <div className="space-y-2">{inProgress.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-[#9A9A9A] hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`${typography.cardTitle} ${textColor.card}`}>{item.activity?.name || "Activity details unavailable"}</p>
              <p className={`mt-1 ${typography.metadata} ${textColor.secondary}`}>{item.completionState}{item.activity?.track ? ` · ${item.activity.track}` : ""}{item.activity?.hoursValue ? ` · ${item.activity.hoursValue} hrs` : ""}</p>
            </div>
            <Link href={`/activities/${encodeURIComponent(item.id)}`} className={`inline-flex h-9 shrink-0 items-center justify-center rounded-md px-4 ${typography.button} ${typography.buttonPrimary}`}>Continue</Link>
          </div>
        ))}</div>
      )}
    </section>
  );
}
