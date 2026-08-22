"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquareReply,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button, Input } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import {
  ReviewConfirmPanel,
  type ReviewDecision,
} from "@/components/ReviewConfirmPanel";
import type { Application } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "Submitted", label: "Submitted" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Rejected" },
  { value: "All", label: "All" },
] as const;

function StatusBadge({ status }: { status: string }) {
  if (status === "Accepted") {
    return <Badge variant="success">Accepted</Badge>;
  }
  if (status === "Rejected") {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}

function formatBirthday(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function DetailField({
  label,
  value,
  emphasize,
}: {
  label: string;
  value?: string | number | null;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "text-lg font-bold text-foreground"
            : "text-sm text-foreground"
        }
      >
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

export default function ReviewApplicationsPage() {
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Submitted");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const {
    data,
    setData: setApps,
    loading,
    refreshing,
    refresh,
  } = useCachedResource<Application[]>(
    "applications",
    async () => {
      const res = await fetch("/api/applications?status=All");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load applications");
      return (body.applications ?? []) as Application[];
    },
    {
      onError: (err) =>
        toast(err instanceof Error ? err.message : "Failed to load", "error"),
    }
  );
  const apps = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((app) => {
      const matchesStatus =
        statusFilter === "All" ? true : app.status === statusFilter;
      const matchesSearch =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [apps, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const selected = selectedId
    ? apps.find((a) => a.id === selectedId) ?? null
    : null;

  const handleRefresh = async () => {
    try {
      await fetch("/api/refresh-applications-cache", { method: "POST" });
    } catch {
      // still reload list
    }
    await refresh();
  };

  const closeModal = () => {
    setSelectedId(null);
    setDecision(null);
    setReplyOpen(false);
    setReplyText("");
  };

  const openModal = (
    id: string,
    nextDecision: ReviewDecision | null = null
  ) => {
    setSelectedId(id);
    setDecision(nextDecision);
    setReplyOpen(false);
    setReplyText("");
  };

  const applyOptimisticStatus = (
    id: string,
    status: "Accepted" | "Rejected"
  ) => {
    setApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status } : app))
    );
  };

  const runBackgroundReview = async (
    id: string,
    action: "approve" | "reject",
    choice: string,
    note: string,
    previousStatus: Application["status"],
    reply: string
  ) => {
    const post = (phase: "status" | "followup") =>
      fetch("/api/applications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          applicationId: id,
          choice,
          note: note || undefined,
          replyText: reply || undefined,
          phase,
        }),
      });

    try {
      // Phase 1 — the status write. Confirm as soon as this lands.
      const res = await post("status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Background update failed");
      toast(
        action === "approve" ? "Application approved" : "Application rejected"
      );

      // Phase 2 — email + Person/History. The reviewer doesn't wait on these,
      // and failures are recorded in Airtable for the dev team, not toasted.
      void post("followup").catch((err) =>
        console.error("[review-applications] follow-up failed:", err)
      );
    } catch (err) {
      // Revert the optimistic update — the write never actually persisted.
      setApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: previousStatus } : a))
      );
      const message =
        err instanceof Error
          ? err.message
          : "Background update failed. Check Airtable";
      toast(message, "error");
    }
  };

  const confirmReview = (
    app: Application,
    action: "approve" | "reject",
    choice: string,
    note: string
  ) => {
    const previousStatus = app.status;
    // Capture before closeModal() clears the reply draft.
    const reply = app.comments ? replyText.trim() : "";
    applyOptimisticStatus(
      app.id,
      action === "approve" ? "Accepted" : "Rejected"
    );
    closeModal();
    void runBackgroundReview(
      app.id,
      action,
      choice,
      note,
      previousStatus,
      reply
    );
  };

  const isSubmitted = selected?.status === "Submitted";

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <div className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">
              Review Applications
            </h1>
            <p className="mt-1 text-[#747474]">
              Approve or reject membership applications
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
          >
            Refresh
            <RefreshCw
              className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex w-full rounded-lg bg-muted p-1 sm:w-auto">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                  statusFilter === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="search-applications"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!h-11 !rounded-full !border-transparent !bg-muted !pl-11 focus-visible:!ring-[#09b5ff] focus-visible:!ring-offset-0"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-muted/60"
              />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No applications found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">
                      Email
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">
                      Track
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((app) => (
                    <tr
                      key={app.id}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      onClick={() => openModal(app.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {app.name || "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {app.email || "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {app.track || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {app.status === "Submitted" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="gap-1.5 !bg-[#09b5ff] !text-white hover:!opacity-90"
                              onClick={() => openModal(app.id, "approve")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openModal(app.id, "reject")}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {safePage}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {selected.name || "Applicant"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  <Badge variant="default">{selected.role || "Volunteer"}</Badge>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={closeModal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Email" value={selected.email} />
                <DetailField label="Track" value={selected.track} />
                <div className="flex items-end gap-4">
                  <DetailField
                    label="Birthday"
                    value={formatBirthday(selected.birthday)}
                  />
                  <DetailField
                    label="Age"
                    value={selected.age}
                    emphasize
                  />
                </div>
                <DetailField label="School" value={selected.school} />
                <DetailField label="State" value={selected.state} />
                <DetailField label="Country" value={selected.country} />
                <DetailField
                  label="Languages"
                  value={selected.languages.join(", ") || null}
                />
                <DetailField label="Discovery" value={selected.discovery} />
              </div>

              {selected.interestStatement ? (
                <div className="mt-6">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Interest Statement
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">
                    {selected.interestStatement}
                  </p>
                </div>
              ) : null}

              {selected.comments ? (
                <div className="mt-6">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Comments
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">
                    {selected.comments}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => setReplyOpen((v) => !v)}
                  >
                    <MessageSquareReply className="h-4 w-4" />
                    Reply to Comment
                  </Button>
                  {replyOpen ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply to the applicant's comment..."
                        rows={4}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09b5ff]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sent to the applicant with your decision when you
                        approve or reject.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {isSubmitted ? (
              decision ? (
                <ReviewConfirmPanel
                  key={decision}
                  decision={decision}
                  onCancel={() => setDecision(null)}
                  onConfirm={(choice, note) =>
                    confirmReview(selected, decision, choice, note)
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => setDecision("reject")}
                  >
                    <XCircle className="h-5 w-5" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full gap-2 !bg-[#09b5ff] !text-white hover:!opacity-90"
                    onClick={() => setDecision("approve")}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Approve
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
