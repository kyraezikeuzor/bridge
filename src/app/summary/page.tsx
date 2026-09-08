"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Printer, RefreshCw, Search } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { Certificate } from "@/components/summary/Certificate";
import { formatHours } from "@/components/summary/format";
import { HoursTable } from "@/components/summary/HoursTable";
import { useToast } from "@/components/ToastProvider";
import type { HoursRequest } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";
import { textColor, typography } from "@/styles/typography";

const PRINT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const PRINTED_AT = PRINT_DATE_FORMAT.format(new Date());

type PersonHours = {
  approvedThisMonth: number;
  pendingReview: number;
  lifetimeTotal: number;
  records: HoursRequest[];
};

export default function HoursSummaryPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const personId = session?.user?.personId || "";
  const { data, loading, refreshing, refresh } = useCachedResource<PersonHours>(
    `person-hours:${personId}`,
    async () => {
      const response = await fetch(`/api/person-hours?personId=${encodeURIComponent(personId)}`);
      if (!response.ok) throw new Error("Failed to load hours");
      const body = await response.json();
      return {
        approvedThisMonth: body.approvedThisMonth ?? 0,
        pendingReview: body.pendingReview ?? 0,
        lifetimeTotal: body.lifetimeTotal ?? 0,
        records: (body.records ?? []) as HoursRequest[],
      };
    },
    {
      enabled: sessionStatus !== "loading" && Boolean(personId),
      onError: (error) => toast(error instanceof Error ? error.message : "Failed to load hours", "error"),
    }
  );
  const records = useMemo(() => data?.records ?? [], [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? records.filter((row) => row.activityName.toLowerCase().includes(query) || row.description?.toLowerCase().includes(query))
      : records;
  }, [records, search]);
  const approved = useMemo(() => {
    const rows = records.filter((row) => row.status === "Approved");
    rows.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    return rows;
  }, [records]);
  const total = approved.reduce((sum, row) => sum + (row.hoursRequested ?? 0), 0);
  const tracks = Array.from(approved.reduce((result, row) => {
    if (row.track) result.add(row.track);
    return result;
  }, new Set<string>())).join(", ");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className={`${typography.pageTitle} ${textColor.primary}`}>Hours Summary</h1><p className={`mt-2 ${typography.body} ${textColor.secondary}`}>{loading ? "Loading your hours…" : `${formatHours(total)} approved across ${approved.length} ${approved.length === 1 ? "entry" : "entries"}`}</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/request" className={`inline-flex h-9 items-center rounded-md px-3 ${typography.button} ${typography.buttonSecondary} transition-colors`}>Missing hours?</Link>
            <Button type="button" variant="outline" size="sm" className={typography.buttonSecondary} onClick={() => void refresh()} disabled={refreshing || loading}>Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button>
            <Button type="button" variant="outline" size="sm" className={`gap-1.5 ${typography.button} ${typography.buttonSecondary}`} onClick={() => window.print()} disabled={loading || approved.length === 0}><Printer className="h-4 w-4" /> Print Hours Certificate</Button>
          </div>
        </header>
        <div className="relative w-full sm:w-56"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><label htmlFor="search-hours-summary" className="sr-only">Search hours</label><Input id="search-hours-summary" name="search-hours-summary" placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} className="!h-11 !rounded-full !border-transparent !bg-muted !pl-11" /></div>
        <HoursTable loading={loading} rows={filtered} hasRecords={records.length > 0} />
      </div>
      <Certificate firstName={session?.user?.firstName || ""} lastName={session?.user?.lastName || ""} role={session?.user?.role || "Volunteer"} tracks={tracks} rows={approved} total={total} printedAt={PRINTED_AT} />
    </AppShell>
  );
}
