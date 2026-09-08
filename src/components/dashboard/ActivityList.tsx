import Link from "next/link";
import type { ClaimedActivity } from "@/lib/airtable";
import { textColor, typography } from "@/styles/typography";

export function ActivityList({ loading, activities }: { loading: boolean; activities: ClaimedActivity[] }) {
  return (
    <section className="rounded-xl border-2 border-border bg-background p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`${typography.status} uppercase ${textColor.secondary}`}>Your activities in progress</h3>
        <Link href="/activities" className={`inline-flex h-9 items-center rounded-md px-3 ${typography.button} ${typography.buttonSecondary} transition-colors`}>See all claimed activities</Link>
      </div>
      {loading ? <div className="space-y-2"><div className="h-16 animate-pulse rounded bg-muted/70" /><div className="h-16 animate-pulse rounded bg-muted/70" /></div> : activities.length === 0 ? (
        <p className={`${typography.bodySmall} ${textColor.secondary}`}>No activities in progress. Completed work is in My Activities.</p>
      ) : (
        <div className="space-y-2">{activities.slice(0, 3).map((item) => (
          <Link key={item.id} href={`/activities/${encodeURIComponent(item.id)}`} className="block rounded-lg border border-border px-4 py-3 transition-colors hover:border-[#9A9A9A] hover:bg-muted/50">
            <p className={`${typography.cardTitle} ${textColor.card}`}>{item.activity?.name || "Activity details unavailable"}</p>
            <p className={`mt-1 ${typography.metadata} ${textColor.secondary}`}>{item.activity?.track || "General"}{item.activity?.hoursValue ? ` · ${item.activity.hoursValue} hrs` : ""}</p>
          </Link>
        ))}</div>
      )}
    </section>
  );
}
