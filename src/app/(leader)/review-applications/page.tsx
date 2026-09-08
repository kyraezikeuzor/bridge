"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import type { ReviewDecision } from "@/components/ReviewConfirmPanel";
import { ApplicationDialog } from "@/components/reviews/applications/ApplicationDialog";
import { ApplicationsTable } from "@/components/reviews/applications/ApplicationsTable";
import { ReviewPager } from "@/components/reviews/shared/ReviewPager";
import { ReviewToolbar } from "@/components/reviews/shared/ReviewToolbar";
import type { Application } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["Submitted", "Accepted", "Rejected", "All"].map(
  (value) => ({ value, label: value })
);

export default function ReviewApplicationsPage() {
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Submitted");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const { data, setData, loading, refreshing, refresh } =
    useCachedResource<Application[]>(
      "applications",
      async () => {
        const response = await fetch("/api/applications?status=All");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Failed to load applications");
        return (body.applications ?? []) as Application[];
      },
      {
        onError: (error) =>
          toast(error instanceof Error ? error.message : "Failed to load applications", "error"),
      }
    );

  const applications = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter(
      (application) =>
        (status === "All" || application.status === status) &&
        (!query || application.name.toLowerCase().includes(query) || application.email.toLowerCase().includes(query))
    );
  }, [applications, search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = selectedId ? applications.find((application) => application.id === selectedId) ?? null : null;

  useEffect(() => setPage(1), [search, status]);

  const closeDialog = () => {
    setSelectedId(null);
    setDecision(null);
    setReplyOpen(false);
    setReply("");
  };

  const openDialog = (id: string, nextDecision?: ReviewDecision) => {
    setSelectedId(id);
    setDecision(nextDecision ?? null);
    setReplyOpen(false);
    setReply("");
  };

  const handleRefresh = async () => {
    await fetch("/api/refresh-applications-cache", { method: "POST" }).catch(() => undefined);
    await refresh();
  };

  const confirmReview = (choice: string, note: string) => {
    if (!selected || !decision) return;
    const application = selected;
    const action = decision;
    const responseText = application.comments ? reply.trim() : "";
    const nextStatus = action === "approve" ? "Accepted" : "Rejected";
    setData((current) => current.map((item) => (item.id === application.id ? { ...item, status: nextStatus } : item)));
    closeDialog();

    const post = (phase: "status" | "followup") =>
      fetch("/api/applications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationId: application.id,
          choice,
          note: note || undefined,
          replyText: responseText || undefined,
          phase,
        }),
      });

    void post("status")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Background update failed");
        toast(action === "approve" ? "Application approved" : "Application rejected");
        void post("followup").catch((error) => console.error("[review-applications] follow-up failed:", error));
      })
      .catch((error) => {
        setData((current) => current.map((item) => (item.id === application.id ? application : item)));
        toast(error instanceof Error ? error.message : "Background update failed", "error");
      });
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <header className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">Review Applications</h1>
            <p className="mt-1 text-[#747474]">Approve or reject membership applications</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing || loading}>
            Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="px-6 py-5 sm:px-8">
        <ReviewToolbar options={STATUS_OPTIONS} value={status} onValueChange={setStatus} search={search} onSearchChange={setSearch} searchLabel="search-applications" />
        <ApplicationsTable loading={loading} rows={pageRows} onOpen={openDialog} />
        {!loading && pageRows.length > 0 ? <ReviewPager page={safePage} pageCount={pageCount} onPageChange={setPage} /> : null}
      </main>

      {selected ? (
        <ApplicationDialog application={selected} decision={decision} replyOpen={replyOpen} reply={reply} onDecisionChange={setDecision} onReplyOpenChange={setReplyOpen} onReplyChange={setReply} onConfirm={confirmReview} onClose={closeDialog} />
      ) : null}
    </div>
  );
}
