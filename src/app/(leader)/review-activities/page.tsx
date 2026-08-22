"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import {
  addActivityLinks,
} from "@/data/leader-mock";
import type { Activity } from "@/lib/airtable";
import type { ReviewActivityStatus } from "@/lib/leader-types";
import { useCachedResource } from "@/lib/useCachedResource";

type TabKey = ReviewActivityStatus;

type ReviewActivity = {
  id: string;
  activityName: string;
  track: string;
  type: string;
  description: string;
  hoursValue: number;
  spotsAvailable: number;
  startDate?: string;
  endDate?: string;
  languages: string[];
  status: ReviewActivityStatus;
  filloutLink?: string;
};

function toReviewActivity(activity: Activity): ReviewActivity | null {
  if (
    activity.status !== "Submitted" &&
    activity.status !== "Active" &&
    activity.status !== "Closed"
  ) {
    return null;
  }

  return {
    id: activity.id,
    activityName: activity.name,
    track: activity.track || "General",
    type: activity.type || "Other",
    description: activity.description || "",
    hoursValue: activity.hoursValue,
    spotsAvailable: Math.max(0, activity.slotsTotal - activity.slotsFilled),
    startDate: activity.startDate || undefined,
    endDate: activity.endDate || undefined,
    languages: activity.languages,
    status: activity.status,
    filloutLink: activity.filloutLink || undefined,
  };
}

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US");
  } catch {
    return d;
  }
}

function generateDiscordPost(a: ReviewActivity): string {
  const track = a.track || "General";
  const name = a.activityName || "Untitled Activity";
  const details = a.description || "No details provided.";
  const langs = a.languages?.join(", ");
  const start = formatDate(a.startDate);
  const end = a.endDate ? formatDate(a.endDate) : "";
  const hours = a.hoursValue ?? 0;
  const isEducation = track.toLowerCase() === "education";
  const claimUrl = a.filloutLink || "CLAIM_FORM_URL";

  if (isEducation) {
    const deadline = end || start;
    let post = `@Education Volunteer\n`;
    post += `**New Volunteer Activity:**\n`;
    post += `${name}\n\n`;
    post += `${details}\n\n`;
    post += `**Details:**\n`;
    if (langs) post += `• Languages: ${langs}\n`;
    post += `• Spots: ${a.spotsAvailable} remaining\n`;
    post += `• Deadline: ${deadline}\n`;
    post += `• Hours: ${hours}\n\n`;
    post += `**How to claim:**\n`;
    post += `1. Claim this activity first: [Claim Activity](${claimUrl})\n`;
    post += `2. Click the activity in Bridge to see the full instructions\n`;
    post += `3. Complete the activity sections\n`;
    post += `4. Log your hours in Bridge\n`;
    return post;
  }

  const dateLine = !end || end === start ? start : `${start}–${end}`;
  let post = `@${track} Volunteer\n${name}\n\n${details}\n`;
  post += `Spots: ${a.spotsAvailable}\n`;
  post += `Dates: ${dateLine}\nHours: ${hours}\n\n`;
  post += `Claim this activity first: [Claim Activity](${claimUrl})\n`;
  return post;
}

function DiscordPostModal({
  activity,
  onClose,
}: {
  activity: ReviewActivity;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => generateDiscordPost(activity));
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — mock UI
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-card-foreground">
          Discord Post Preview
        </h3>
        <p className="text-sm text-muted-foreground">
          Edit the text below before copying.
        </p>
        <textarea
          className="h-64 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewActivityStatus }) {
  if (status === "Active") {
    return <Badge variant="success">Active</Badge>;
  }
  if (status === "Closed") {
    return <Badge variant="outline">Closed</Badge>;
  }
  return <Badge variant="default">Submitted</Badge>;
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children ?? (
        <p className="text-sm text-foreground">
          {value === null || value === undefined || value === "" ? "—" : value}
        </p>
      )}
    </div>
  );
}

export default function ReviewActivitiesPage() {
  const { push: toast } = useToast();
  const [tab, setTab] = useState<TabKey>("Active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discordActivity, setDiscordActivity] = useState<ReviewActivity | null>(
    null
  );

  const { data, loading, refreshing, refresh } = useCachedResource<
    ReviewActivity[]
  >(
    "activities",
    async () => {
      const response = await fetch("/api/activities");
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Failed to load activities");
      }
      return (body.activities as Activity[])
        .map(toReviewActivity)
        .filter((activity): activity is ReviewActivity => activity !== null);
    },
    {
      onError: (error) => {
        console.error("[review-activities] load failed:", error);
        toast(
          error instanceof Error ? error.message : "Failed to load activities",
          "error"
        );
      },
    }
  );
  const activities = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(
    () => activities.filter((a) => a.status === tab),
    [activities, tab]
  );

  const selected = selectedId
    ? (activities.find((a) => a.id === selectedId) ?? null)
    : null;

  const closeModal = () => setSelectedId(null);

  const handleRefresh = async () => {
    try {
      await fetch("/api/refresh-activities-cache", { method: "POST" });
    } catch {
      // still reload
    }
    await refresh();
  };

  const handleStatusChange = async (
    id: string,
    status: ReviewActivityStatus
  ) => {
    const response = await fetch("/api/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: id, status }),
    });
    if (!response.ok) {
      const body = await response.json();
      console.error(
        "[review-activities] status update failed:",
        body.error || "Unknown error"
      );
      toast(body.error || "Failed to update activity", "error");
      return;
    }
    toast("Activity status updated");
    closeModal();
    await refresh();
  };

  const tabs: TabKey[] = ["Submitted", "Active", "Closed"];

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <div className="px-6 pb-2 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F]">
              Review Activities
            </h1>
            <p className="mt-1 text-[#747474]">
              Approve, reject, and manage volunteer activities
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {addActivityLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="outline" size="sm">
                  {link.label}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </a>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              Refresh
              <RefreshCw
                className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 sm:px-8">
        <div className="mb-5 flex rounded-lg bg-muted p-1 sm:w-80">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
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
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No {tab.toLowerCase()} activities found.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Activity
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">
                    Track
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">
                    Type
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Hours
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
                    Spots
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
                    Dates
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
                {filtered.map((activity) => (
                  <tr
                    key={activity.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                    onClick={() => setSelectedId(activity.id)}
                  >
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">
                      {activity.activityName}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {activity.track}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {activity.type}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {activity.hoursValue}
                    </td>
                    <td className="hidden px-4 py-3 text-foreground lg:table-cell">
                      {activity.spotsAvailable}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(activity.startDate)} –{" "}
                      {formatDate(activity.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={activity.status} />
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        {activity.status === "Submitted" ? (
                          <>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="gap-1.5 !bg-[#0584C5] !text-[#E2F4FE] hover:!opacity-90"
                              onClick={() =>
                                void handleStatusChange(activity.id, "Active")
                              }
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() =>
                                void handleStatusChange(activity.id, "Closed")
                              }
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        ) : activity.status === "Active" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              void handleStatusChange(activity.id, "Closed")
                            }
                          >
                            <Archive className="h-4 w-4" />
                            Close
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  {selected.activityName}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  <Badge variant="default" size="sm">
                    {selected.track}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {selected.type}
                  </Badge>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <DetailField label="Hours" value={selected.hoursValue} />
                <DetailField label="Spots" value={selected.spotsAvailable} />
                <DetailField
                  label="Dates"
                  value={`${formatDate(selected.startDate)} – ${formatDate(
                    selected.endDate
                  )}`}
                />
                {selected.languages.length > 0 ? (
                  <DetailField
                    label="Languages"
                    value={selected.languages.join(", ")}
                  />
                ) : null}
              </div>

              {selected.description ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {selected.description}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDiscordActivity(selected)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Discord Post
              </Button>
              {selected.status === "Submitted" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleStatusChange(selected.id, "Closed")}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="gap-1.5 !bg-[#0584C5] !text-[#E2F4FE] hover:!opacity-90"
                    onClick={() => void handleStatusChange(selected.id, "Active")}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              ) : selected.status === "Active" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void handleStatusChange(selected.id, "Closed")}
                >
                  <Archive className="h-4 w-4" />
                  Close Activity
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {discordActivity ? (
        <DiscordPostModal
          activity={discordActivity}
          onClose={() => setDiscordActivity(null)}
        />
      ) : null}
    </div>
  );
}
