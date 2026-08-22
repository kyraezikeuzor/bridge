"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button, Input } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import {
  HOURS_REJECT_REASONS,
  ReviewConfirmPanel,
  type ReviewDecision,
} from "@/components/ReviewConfirmPanel";
import type { HoursRequest } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "All", label: "All" },
] as const;

function StatusBadge({ status }: { status: string }) {
  if (status === "Approved") {
    return <Badge variant="success">Approved</Badge>;
  }
  if (status === "Rejected") {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}

function yesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Yes" : "No";
}

function DetailField({
  label,
  value,
  emphasize,
  children,
}: {
  label: string;
  value?: string | number | null;
  emphasize?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children ?? (
        <p
          className={
            emphasize
              ? "text-2xl font-bold text-foreground"
              : "text-sm text-foreground"
          }
        >
          {value === null || value === undefined || value === "" ? "—" : value}
        </p>
      )}
    </div>
  );
}

function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max)}…`;
}

/**
 * A submission's written work. Some start with a pasted Drive link followed by
 * the text, so the leading URL is pulled out and linked separately.
 */
function SubmissionContent({ content }: { content: string }) {
  const match = content.match(/^(https?:\/\/\S+)\s*([\s\S]*)$/);
  const url = match?.[1];
  const body = (match?.[2] ?? content).trim();

  return (
    <div className="mt-2 space-y-1.5">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{truncateUrl(url, 60)}</span>
        </a>
      ) : null}
      {body ? (
        <p className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
          {body}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Hours to award by default: the linked activity's value, since that's what an
 * activity is worth. Falls back to what the volunteer requested when there's no
 * linked activity (most rows) or the activity has no value set.
 */
function defaultHoursFor(row: HoursRequest): string {
  const fromActivity = row.linkedActivity?.hoursValue;
  if (typeof fromActivity === "number" && fromActivity > 0) {
    return String(fromActivity);
  }
  return row.hoursRequested === null || row.hoursRequested === undefined
    ? ""
    : String(row.hoursRequested);
}

export default function ReviewHoursPage() {
  const { push: toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Submitted");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [hoursInput, setHoursInput] = useState("");

  const {
    data,
    setData: setRows,
    loading,
    refreshing,
    refresh,
  } = useCachedResource<HoursRequest[]>(
    "hours",
    async () => {
      const res = await fetch("/api/hours?status=All");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load hours");
      return (body.hours ?? []) as HoursRequest[];
    },
    {
      onError: (err) =>
        toast(
          err instanceof Error ? err.message : "Failed to load hours",
          "error"
        ),
    }
  );
  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "All" ? true : row.status === statusFilter;
      const matchesSearch =
        !q ||
        row.personName.toLowerCase().includes(q) ||
        row.activityName.toLowerCase().includes(q) ||
        (row.description?.toLowerCase().includes(q) ?? false) ||
        (row.linkedActivity?.name.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

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
    ? (rows.find((r) => r.id === selectedId) ?? null)
    : null;

  const handleRefresh = async () => {
    try {
      await fetch("/api/refresh-hours-cache", { method: "POST" });
    } catch {
      // still reload
    }
    await refresh();
  };

  const closeModal = () => {
    setSelectedId(null);
    setDecision(null);
    setHoursInput("");
  };

  const openModal = (
    id: string,
    nextDecision: ReviewDecision | null = null
  ) => {
    setSelectedId(id);
    setDecision(nextDecision);
    const row = rows.find((r) => r.id === id);
    setHoursInput(row ? defaultHoursFor(row) : "");
  };

  const applyOptimisticStatus = (
    id: string,
    status: "Approved" | "Rejected",
    hours?: number
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              hoursRequested: hours ?? row.hoursRequested,
            }
          : row
      )
    );
  };

  const runBackgroundReview = async (
    id: string,
    action: "approve" | "reject",
    choice: string,
    note: string,
    hours?: number
  ) => {
    try {
      const res = await fetch("/api/hours/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          hoursId: id,
          choice,
          note: note || undefined,
          hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Background update failed");
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Background update failed. Check Airtable",
        "error"
      );
    }
  };

  const confirmReview = (
    row: HoursRequest,
    action: "approve" | "reject",
    choice: string,
    note: string
  ) => {
    // On approve, always write the hours shown — that's either the linked
    // activity's value or whatever the reviewer typed over it.
    const parsed = Number(hoursInput);
    const hours =
      action === "approve" &&
      hoursInput.trim() !== "" &&
      Number.isFinite(parsed) &&
      parsed >= 0
        ? parsed
        : undefined;

    applyOptimisticStatus(
      row.id,
      action === "approve" ? "Approved" : "Rejected",
      hours
    );
    closeModal();
    toast(action === "approve" ? "Hours approved" : "Hours not approved");
    void runBackgroundReview(row.id, action, choice, note, hours);
  };

  const isSubmitted = selected?.status === "Submitted";

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <div className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">Review Hours</h1>
            <p className="mt-1 text-[#747474]">
              Approve or reject volunteer hours requests
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
              name="search-hours"
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
            No hours requests found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Volunteer
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">
                      Activity
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Hours
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">
                      Date
                    </th>
                    <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
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
                  {pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      onClick={() => openModal(row.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        <span className="flex items-center gap-1.5">
                          {row.personName || "—"}
                          {row.missingRequiredSubmission ? (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-amber-600"
                              aria-label="No submission provided"
                            />
                          ) : row.submissions.length > 0 ? (
                            <Paperclip
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-label={`${row.submissions.length} submission(s)`}
                            />
                          ) : null}
                        </span>
                      </td>
                      <td className="hidden max-w-[220px] truncate px-4 py-3 text-muted-foreground sm:table-cell">
                        {truncateUrl(row.activityName, 48)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.hoursRequested ?? "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                        {row.dateLabel || "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {row.track || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.status === "Submitted" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openModal(row.id, "approve")}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openModal(row.id, "reject")}
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
                  {selected.personName || "Volunteer"} — Hours Request
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.track ? (
                    <Badge variant="outline">{selected.track}</Badge>
                  ) : null}
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
                <DetailField label="Hours">
                  {isSubmitted ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        aria-label="Hours to award"
                        className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-2xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09b5ff]"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.linkedActivity?.hoursValue
                          ? `Activity value: ${selected.linkedActivity.hoursValue} · Requested: ${selected.hoursRequested ?? "—"}`
                          : `Requested: ${selected.hoursRequested ?? "—"}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {selected.hoursRequested ?? "—"}
                    </p>
                  )}
                </DetailField>
                <DetailField label="Date" value={selected.dateLabel} />
                <DetailField
                  label="Ownership Agreement"
                  value={yesNo(selected.ownershipAgreement)}
                />
                <DetailField
                  label="Photo Permissions"
                  value={yesNo(selected.photoPermissions)}
                />
                <DetailField label="Proof">
                  {selected.proofUrl ? (
                    <a
                      href={selected.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      View Proof Link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No proof provided
                    </p>
                  )}
                </DetailField>
                {selected.description ? (
                  <DetailField
                    label="Description"
                    value={selected.description}
                  />
                ) : null}
              </div>

              {selected.activitySubmission ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Activity Submission
                  </p>
                  <p className="break-all text-sm text-foreground">
                    {selected.activitySubmission}
                  </p>
                </div>
              ) : null}

              {selected.missingRequiredSubmission ? (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      No submission provided
                    </p>
                    <p className="mt-0.5 text-sm text-amber-800">
                      This is a Submission activity, so the volunteer&apos;s work
                      is required before these hours can be approved.
                    </p>
                  </div>
                </div>
              ) : null}

              {selected.submissions.length > 0 ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Submissions ({selected.submissions.length})
                  </p>
                  <div className="space-y-2">
                    {selected.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {submission.activityName || "Submission"}
                          </p>
                          {submission.category ? (
                            <Badge variant="outline">{submission.category}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge variant="warning">{submission.status}</Badge>
                          {submission.submittedDate ? (
                            <span className="text-sm text-muted-foreground">
                              {submission.submittedDate}
                            </span>
                          ) : null}
                        </div>
                        {submission.files.map((file) => (
                          <a
                            key={file.url}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-all">{file.filename}</span>
                          </a>
                        ))}
                        {submission.content ? (
                          <SubmissionContent content={submission.content} />
                        ) : null}
                        {submission.files.length === 0 && !submission.content ? (
                          <p className="mt-2 text-sm italic text-muted-foreground">
                            No file or text submitted
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selected.linkedActivity ? (
                <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Linked Activity
                  </p>
                  <p className="font-semibold text-foreground">
                    {selected.linkedActivity.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      selected.linkedActivity.track,
                      selected.linkedActivity.hoursValue
                        ? `${selected.linkedActivity.hoursValue} hrs`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Track
                      </p>
                      <p className="text-foreground">
                        {selected.linkedActivity.track || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Hours Value
                      </p>
                      <p className="text-foreground">
                        {selected.linkedActivity.hoursValue || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {isSubmitted ? (
              decision ? (
                <ReviewConfirmPanel
                  key={decision}
                  decision={decision}
                  rejectOptions={HOURS_REJECT_REASONS}
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
                    className="w-full gap-2"
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
