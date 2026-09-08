"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, Search, XCircle } from "lucide-react";
import { Badge, Button, Input } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import type { Contribution } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

type ReviewContribution = Contribution & {
  personName: string;
  activityName: string;
  hoursValue: number;
  platform: string;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function StatusBadge({ status }: { status: string }) {
  if (status === "Approved") return <Badge variant="success">Approved</Badge>;
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="default">Submitted</Badge>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

export default function ReviewContributionsPage() {
  const { push: toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Submitted");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { data, setData, loading, refreshing, refresh } = useCachedResource<ReviewContribution[]>(
    "contributions",
    async () => {
      const response = await fetch("/api/contributions");
      if (!response.ok) throw new Error("Failed to load contributions");
      const body = await response.json();
      return body.contributions as ReviewContribution[];
    },
    { onError: (error) => toast(error instanceof Error ? error.message : "Failed to load contributions", "error") }
  );
  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) =>
      (status === "All" || row.status === status) &&
      (!search || [row.personName, row.activityName, row.notes, row.workLink].some((value) => value?.toLowerCase().includes(search)))
    );
  }, [rows, query, status]);

  async function review(row: ReviewContribution, action: "approve" | "reject") {
    setReviewingId(row.id);
    try {
      const response = await fetch("/api/contributions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId: row.id, action }),
      });
      if (!response.ok) throw new Error("Failed to review contribution");
      const body = await response.json();
      setData((previous) => previous.map((item) => item.id === row.id ? { ...item, ...body.contribution } : item));
      toast(action === "approve" ? `Approved — ${row.hoursValue} hours awarded` : "Contribution rejected");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to review contribution", "error");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-6 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#3F3F3F]">Review Contributions</h1>
          <p className="mt-1 text-[#747474]">Approve completed work and award the activity&apos;s configured hours.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading || refreshing}>
          Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg bg-muted p-1">
          {["Submitted", "Approved", "Rejected", "All"].map((option) => (
            <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-md px-3 py-2 text-sm font-medium ${status === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{option}</button>
          ))}
        </div>
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." className="!h-10 !pl-9" /></div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm"><thead><tr className="border-b border-border bg-muted/40 text-left"><th className="px-4 py-3 font-medium text-muted-foreground">Volunteer</th><th className="px-4 py-3 font-medium text-muted-foreground">Activity</th><th className="px-4 py-3 font-medium text-muted-foreground">Work</th><th className="px-4 py-3 font-medium text-muted-foreground">Hours</th><th className="px-4 py-3 font-medium text-muted-foreground">Status</th><th className="px-4 py-3 font-medium text-muted-foreground">Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading contributions…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No contributions found.</td></tr> : filtered.map((row) => <tr key={row.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{row.personName}<span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDate(row.submittedAt)}</span></td><td className="px-4 py-3">{row.activityName}{row.notes ? <span className="mt-1 block max-w-[250px] whitespace-pre-wrap text-xs text-muted-foreground">{row.notes}</span> : null}</td><td className="px-4 py-3">{row.workLink ? <a href={row.workLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{row.platform === "Oppia" ? "Certificate" : "Open"} <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-muted-foreground">Saved submissions</span>}</td><td className="px-4 py-3">{row.hoursValue}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3">{row.status === "Submitted" ? <div className="flex gap-2"><Button type="button" variant="primary" size="sm" disabled={reviewingId === row.id} onClick={() => void review(row, "approve")}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button type="button" variant="outline" size="sm" disabled={reviewingId === row.id} onClick={() => void review(row, "reject")}><XCircle className="mr-1 h-4 w-4" />Reject</Button></div> : <span className="text-xs text-muted-foreground">{row.hoursRecordId ? "Hours awarded" : "—"}</span>}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
