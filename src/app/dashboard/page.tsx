"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  RefreshCw,
  UserCog,
  Zap,
} from "lucide-react";
import { Button, Card, CardContent } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { volunteerQuickLinks } from "@/data/session";
import { isLeaderRole } from "@/lib/roles";
import type { Activity as ClaimedActivity } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0 a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function QuickLinkIcon({
  icon,
}: {
  icon: "discord" | "globe" | "book" | "clipboard" | "zap";
}) {
  const className = "h-5 w-5 text-foreground";
  if (icon === "discord") return <DiscordIcon className={className} />;
  if (icon === "globe") return <Globe className={className} />;
  if (icon === "clipboard") return <ClipboardList className={className} />;
  if (icon === "zap") return <Zap className={className} />;
  return <BookOpen className={className} />;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-5 animate-pulse rounded bg-muted/70 ${className}`} />
  );
}

type PendingCounts = {
  applications: number;
  hours: number;
  activitiesInProgress: number;
};
type HoursSummary = {
  approvedThisMonth: number;
  pendingReview: number;
  lifetimeTotal: number;
};

type DashboardData = {
  pending: PendingCounts | null;
  hoursSummary: HoursSummary | null;
  claimed: ClaimedActivity[];
};

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const firstName = session?.user?.firstName || "there";
  const personId = session?.user?.personId || "";
  const isDirector = isLeaderRole(session?.user?.role);

  const { data, loading, refreshing, refresh } =
    useCachedResource<DashboardData>(
      `dashboard:${isDirector ? "director" : `volunteer:${personId}`}`,
      async () => {
        if (isDirector) {
          const res = await fetch("/api/pending-review-counts");
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Failed to load counts");
          return {
            pending: {
              applications: body.applications ?? 0,
              hours: body.hours ?? 0,
              activitiesInProgress: body.activitiesInProgress ?? 0,
            },
            hoursSummary: null,
            claimed: [],
          };
        }

        if (!personId) {
          console.warn(
            "[dashboard] session has no personId — volunteer hours/activities skipped"
          );
          return {
            pending: null,
            hoursSummary: {
              approvedThisMonth: 0,
              pendingReview: 0,
              lifetimeTotal: 0,
            },
            claimed: [],
          };
        }

        const [hoursRes, actsRes] = await Promise.all([
          fetch(`/api/person-hours?personId=${encodeURIComponent(personId)}`),
          fetch(
            `/api/person-activities?personId=${encodeURIComponent(personId)}`
          ),
        ]);
        const hoursData = await hoursRes.json();
        const actsData = await actsRes.json();
        if (!hoursRes.ok) {
          throw new Error(hoursData.error || "Failed to load hours");
        }
        if (!actsRes.ok) {
          throw new Error(actsData.error || "Failed to load activities");
        }
        return {
          pending: null,
          hoursSummary: {
            approvedThisMonth: hoursData.approvedThisMonth ?? 0,
            pendingReview: hoursData.pendingReview ?? 0,
            lifetimeTotal: hoursData.lifetimeTotal ?? 0,
          },
          claimed: (actsData.activities ?? []) as ClaimedActivity[],
        };
      },
      {
        enabled: sessionStatus !== "loading",
        onError: (err) => console.error("[dashboard]", err),
      }
    );

  const pending = data?.pending ?? null;
  const hoursSummary = data?.hoursSummary ?? null;
  const claimed = useMemo(() => data?.claimed ?? [], [data]);

  const handleRefresh = async () => {
    try {
      if (isDirector) {
        await Promise.all([
          fetch("/api/refresh-applications-cache", { method: "POST" }),
          fetch("/api/refresh-hours-cache", { method: "POST" }),
        ]);
      } else {
        await Promise.all([
          fetch("/api/refresh-hours-cache", { method: "POST" }),
          fetch("/api/refresh-activities-cache", { method: "POST" }),
        ]);
      }
    } catch {
      // still reload
    }
    await refresh();
  };

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tighter text-[#3F3F3F] sm:text-4xl">
            {isDirector ? `Welcome back, ${firstName}!` : `Hello, ${firstName}!`}
          </h1>
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

        {isDirector ? (
          <Card variant="outline" className="border-2">
            <CardContent className="p-0">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                  <ClipboardCheck className="h-4 w-4 text-primary-foreground" />
                </div>
                <h2 className="text-lg font-bold text-[#3F3F3F]">
                  Pending Your Review
                </h2>
              </div>
              {loading || !pending ? (
                <div className="space-y-2">
                  <SkeletonLine className="w-2/3" />
                  <SkeletonLine className="w-1/2" />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-base font-medium text-muted-foreground">
                    <span className="font-bold text-[#3F3F3F]">
                      {pending.applications}
                    </span>{" "}
                    application
                    {pending.applications !== 1 ? "s" : ""} awaiting review
                  </p>
                  <p className="text-base font-medium text-muted-foreground">
                    <span className="font-bold text-[#3F3F3F]">
                      {pending.hours}
                    </span>{" "}
                    hour{pending.hours !== 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="text-base font-medium text-muted-foreground">
                    <span className="font-bold text-[#3F3F3F]">
                      {pending.activitiesInProgress}
                    </span>{" "}
                    activit{pending.activitiesInProgress !== 1 ? "ies" : "y"}{" "}
                    in progress
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="outline" className="border-2">
              <CardContent className="p-0">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                    <Activity className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    Your Activity
                  </h2>
                </div>
                {loading || !hoursSummary ? (
                  <div className="space-y-2">
                    <SkeletonLine className="w-3/4" />
                    <SkeletonLine className="w-2/3" />
                    <SkeletonLine className="w-1/2" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-base font-medium text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {hoursSummary.approvedThisMonth}
                      </span>{" "}
                      hours approved this month
                    </p>
                    <p className="text-base font-medium text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {hoursSummary.pendingReview}
                      </span>{" "}
                      submission
                      {hoursSummary.pendingReview !== 1 ? "s" : ""} pending
                      review
                    </p>
                    <p className="text-base font-medium text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {hoursSummary.lifetimeTotal}
                      </span>{" "}
                      lifetime hours approved
                    </p>
                    <p className="text-base font-medium text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {claimed.length}
                      </span>{" "}
                      task{claimed.length !== 1 ? "s" : ""} currently claimed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Claimed activities
              </h3>
              {loading ? (
                <div className="space-y-2">
                  <SkeletonLine className="h-16 w-full" />
                  <SkeletonLine className="h-16 w-full" />
                </div>
              ) : claimed.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">
                  No claimed activities yet. Claim a task to get started.
                </p>
              ) : (
                claimed.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border-2 border-border bg-background p-5"
                  >
                    <p className="font-semibold text-foreground">
                      {activity.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[activity.track, activity.status]
                        .filter(Boolean)
                        .join(" · ")}
                      {activity.hoursValue
                        ? ` · ${activity.hoursValue} hrs`
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isDirector ? "Director actions" : "Quick Links"}
          </h3>
          {isDirector ? (
            <>
              <Link
                href="/review-applications"
                className="group flex items-center gap-5 rounded-xl border-2 border-border bg-background p-5 transition-all hover:border-primary sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#3F3F3F]">
                    Review Applications
                  </p>
                  <p className="mt-0.5 font-medium text-[#747474]">
                    Approve or reject volunteer applications
                  </p>
                </div>
              </Link>
              <Link
                href="/review-hours"
                className="group flex items-center gap-5 rounded-xl border-2 border-border bg-background p-5 transition-all hover:border-primary sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#3F3F3F]">
                    Review Hours
                  </p>
                  <p className="mt-0.5 font-medium text-[#747474]">
                    Approve or reject hours requests
                  </p>
                </div>
              </Link>
              <Link
                href="/profile"
                className="group flex items-center gap-5 rounded-xl border-2 border-border bg-background p-5 transition-all hover:border-primary sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserCog className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#3F3F3F]">
                    Update My Profile
                  </p>
                  <p className="mt-0.5 font-medium text-[#747474]">
                    Keep your information up to date
                  </p>
                </div>
              </Link>
            </>
          ) : (
            volunteerQuickLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex cursor-pointer items-center gap-5 rounded-xl border-2 border-border bg-background p-5 transition-all duration-200 hover:border-primary active:opacity-90 sm:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <QuickLinkIcon icon={item.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-medium text-[#747474]">
                    {item.description}
                  </p>
                </div>
                <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </a>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
