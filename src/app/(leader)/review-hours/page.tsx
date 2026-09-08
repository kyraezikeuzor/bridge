"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import { HoursDialog } from "@/components/reviews/hours/HoursDialog";
import { HoursTable } from "@/components/reviews/hours/HoursTable";
import { ReviewPager } from "@/components/reviews/shared/ReviewPager";
import { ReviewToolbar } from "@/components/reviews/shared/ReviewToolbar";
import type { ReviewDecision } from "@/components/ReviewConfirmPanel";
import type { HoursRequest } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["Submitted", "Approved", "Rejected", "All"].map(
  (value) => ({ value, label: value })
);

function defaultHoursFor(row: HoursRequest): string {
  const activityHours = row.linkedActivity?.hoursValue;
  if (typeof activityHours === "number" && activityHours > 0) {
    return String(activityHours);
  }
  return row.hoursRequested == null ? "" : String(row.hoursRequested);
}

export default function ReviewHoursPage() {
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Submitted");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [hours, setHours] = useState("");
  const { data, setData, loading, refreshing, refresh } =
    useCachedResource<HoursRequest[]>(
      "hours",
      async () => {
        const response = await fetch("/api/hours?status=All");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to load hours");
        return (body.hours ?? []) as HoursRequest[];
      },
      {
        onError: (error) =>
          toast(error instanceof Error ? error.message : "Failed to load hours", "error"),
      }
    );

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [row.personName, row.activityName, row.description, row.linkedActivity?.name];
      return (
        (status === "All" || row.status === status) &&
        (!query || searchable.some((value) => value?.toLowerCase().includes(query)))
      );
    });
  }, [rows, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = selectedId ? rows.find((row) => row.id === selectedId) ?? null : null;

  useEffect(() => setPage(1), [search, status]);

  const closeDialog = () => {
    setSelectedId(null);
    setDecision(null);
    setHours("");
  };

  const openDialog = (id: string, nextDecision?: ReviewDecision) => {
    const row = rows.find((item) => item.id === id);
    setSelectedId(id);
    setDecision(nextDecision ?? null);
    setHours(row ? defaultHoursFor(row) : "");
  };

  const handleRefresh = async () => {
    await fetch("/api/refresh-hours-cache", { method: "POST" }).catch(() => undefined);
    await refresh();
  };

  const confirmReview = (choice: string, note: string) => {
    if (!selected || !decision) return;
    const action = decision;
    const parsed = Number(hours);
    const awarded =
      action === "approve" && hours.trim() && Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : undefined;
    const previous = selected;
    const nextStatus = action === "approve" ? "Approved" : "Rejected";

    setData((current) =>
      current.map((row) =>
        row.id === selected.id
          ? { ...row, status: nextStatus, hoursRequested: awarded ?? row.hoursRequested }
          : row
      )
    );
    closeDialog();

    void fetch("/api/hours/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, hoursId: selected.id, choice, note: note || undefined, hours: awarded }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Background update failed");
        toast(action === "approve" ? "Hours approved" : "Hours not approved");
      })
      .catch((error) => {
        setData((current) => current.map((row) => (row.id === previous.id ? previous : row)));
        toast(error instanceof Error ? error.message : "Background update failed", "error");
      });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <header className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">Review Hours</h1>
            <p className="mt-1 text-[#747474]">Approve or reject volunteer hours requests</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing || loading}>
            Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="px-6 py-5 sm:px-8">
        <ReviewToolbar options={STATUS_OPTIONS} value={status} onValueChange={setStatus} search={search} onSearchChange={setSearch} searchLabel="search-hours" />
        <HoursTable loading={loading} rows={pageRows} onOpen={openDialog} />
        {!loading && pageRows.length > 0 ? <ReviewPager page={safePage} pageCount={pageCount} onPageChange={setPage} /> : null}
      </main>

      {selected ? (
        <HoursDialog row={selected} decision={decision} hours={hours} onHoursChange={setHours} onDecisionChange={setDecision} onConfirm={confirmReview} onClose={closeDialog} />
      ) : null}
    </div>
  );
}
