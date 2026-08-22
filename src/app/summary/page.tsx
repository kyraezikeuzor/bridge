"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ClipboardList, Printer, RefreshCw, Search } from "lucide-react";
import { Badge, Button, Card, CardContent, Input } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/ToastProvider";
import type { HoursRequest } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

type PersonHours = {
  approvedThisMonth: number;
  pendingReview: number;
  lifetimeTotal: number;
  records: HoursRequest[];
};

/** Plain hours count — "3", "1.5" — never a H:MM duration. */
function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Approved") return <Badge variant="success">Approved</Badge>;
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}

export default function HoursSummaryPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");

  const personId = session?.user?.personId || "";
  const firstName = session?.user?.firstName || "";
  const lastName = session?.user?.lastName || "";
  const role = session?.user?.role || "Volunteer";

  const { data, loading, refreshing, refresh } = useCachedResource<PersonHours>(
    `person-hours:${personId}`,
    async () => {
      const res = await fetch(
        `/api/person-hours?personId=${encodeURIComponent(personId)}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load hours");
      return {
        approvedThisMonth: body.approvedThisMonth ?? 0,
        pendingReview: body.pendingReview ?? 0,
        lifetimeTotal: body.lifetimeTotal ?? 0,
        records: (body.records ?? []) as HoursRequest[],
      };
    },
    {
      enabled: sessionStatus !== "loading" && Boolean(personId),
      onError: (err) =>
        toast(
          err instanceof Error ? err.message : "Failed to load hours",
          "error"
        ),
    }
  );

  const records = useMemo(() => data?.records ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.activityName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [records, search]);

  /** The certificate lists approved hours only. */
  const approved = useMemo(
    () =>
      records
        .filter((r) => r.status === "Approved")
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [records]
  );

  const approvedTotal = approved.reduce(
    (sum, r) => sum + (r.hoursRequested ?? 0),
    0
  );

  const tracks = Array.from(
    new Set(approved.map((r) => r.track).filter(Boolean))
  ).join(", ");

  const printedAt = new Date().toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F] sm:text-3xl">
              Hours Summary
            </h1>
            <p className="mt-1 text-[#747474]">
              {loading
                ? "Loading your hours…"
                : `${formatHours(approvedTotal)} approved across ${approved.length} ${
                    approved.length === 1 ? "entry" : "entries"
                  }`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing || loading}
            >
              Refresh
              <RefreshCw
                className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-1.5 !bg-[#09b5ff] !text-white hover:!opacity-90"
              onClick={() => window.print()}
              disabled={loading || approved.length === 0}
            >
              <Printer className="h-4 w-4" />
              Print Hours Certificate
            </Button>
          </div>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search-hours-summary"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!h-11 !rounded-full !border-transparent !bg-muted !pl-11 focus-visible:!ring-[#09b5ff] focus-visible:!ring-offset-0"
          />
        </div>

        <Card variant="outline" className="border">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-md bg-muted/60"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {records.length === 0
                    ? "No hours recorded yet"
                    : "No hours match your search"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Activity
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Hours
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-foreground">
                          {row.dateLabel || formatDate(row.date)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.activityName}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.hoursRequested ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print-only certificate — hidden on screen, revealed by @media print. */}
      <div id="hours-certificate" className="hidden bg-white p-8 text-black">
        <div className="flex items-start justify-between">
          <p className="text-lg italic">Omelora Volunteer Program</p>
          <div className="text-right text-sm">
            <p>Page 1 of 1</p>
            <p>{printedAt}</p>
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="w-1/2 pb-2 text-left font-normal">Job</th>
              <th className="pb-2 text-left font-normal">Start</th>
              <th className="pb-2 text-right font-normal">Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-200">
              <td className="px-2 py-2 font-bold" colSpan={2}>
                {lastName ? `${lastName}, ${firstName}` : firstName || "Volunteer"}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right text-sm">
                Role: {role} &nbsp;|&nbsp; Track: {tracks}
              </td>
            </tr>
            {approved.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-1.5">{row.activityName || "—"}</td>
                <td className="px-2 py-1.5">
                  {row.startDate ? formatDate(row.startDate) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {formatHours(row.hoursRequested ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td className="px-2 pt-2 italic" colSpan={2}>
                Count: {approved.length}
              </td>
              <td className="px-2 pt-2 text-right">
                {formatHours(approvedTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AppShell>
  );
}
