"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { clearResourceCache } from "@/lib/useCachedResource";
import { textColor, typography } from "@/styles/typography";

type Props = {
  activityId: string;
  activity: { name: string; description: string | null; hours: number; status: string | null } | null;
};

export function StartActivity({ activityId, activity }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const closed = !activity || !["open", "active", "full"].includes(activity.status?.trim().toLowerCase() ?? "");

  const signUp = async () => {
    setState("saving");
    setError("");
    try {
      const response = await fetch(`/api/activities/${encodeURIComponent(activityId)}/claim`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "We couldn't sign you up. Please try again.");
      clearResourceCache("my-activities");
      const personId = session?.user?.personId;
      if (personId) clearResourceCache(`dashboard:volunteer:${personId}`);
      router.replace(`/activities/${encodeURIComponent(body.claimId)}`);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "We couldn't sign you up. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sunrise-50 px-4 py-10">
      <div className="w-full max-w-[520px] rounded-xl border border-border bg-background p-6 shadow-lg sm:p-8">
        {activity ? (
          <>
            <p className={`${typography.label} ${textColor.secondary}`}>Sign up for</p>
            <h1 className={`${typography.pageTitle} mt-2 text-2xl sm:text-3xl ${textColor.primary}`}>{activity.name}</h1>
            {activity.hours > 0 && (
              <p className={`${typography.metadata} mt-3 inline-flex items-center gap-1.5 ${textColor.secondary}`}>
                <Clock className="h-4 w-4" aria-hidden />
                {activity.hours} {activity.hours === 1 ? "hour" : "hours"}
              </p>
            )}
            {activity.description && <p className={`${typography.body} mt-4 ${textColor.primary}`}>{activity.description}</p>}
            {closed ? (
              <p className={`${typography.bodySmall} mt-6 rounded-lg bg-muted p-4 ${textColor.primary}`}>This activity isn&apos;t open for signups right now.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={signUp}
                  disabled={state === "saving"}
                  className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-bridge-action text-base font-semibold text-white transition-colors hover:bg-bridge-action-hover disabled:opacity-70"
                >
                  {state === "saving" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                  {state === "saving" ? "Signing you up…" : "Sign up and start"}
                  {state !== "saving" && <ArrowRight className="h-5 w-5" aria-hidden />}
                </button>
                <p className={`${typography.helper} mt-3 ${textColor.secondary}`}>You&apos;ll go straight to the activity, where you can submit your work.</p>
              </>
            )}
            {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">{error}</p>}
          </>
        ) : (
          <>
            <h1 className={`${typography.sectionTitle} ${textColor.primary}`}>Activity not found</h1>
            <p className={`${typography.bodySmall} mt-2 ${textColor.secondary}`}>It may have closed or been removed.</p>
          </>
        )}
        <Link href="/activities" className={`${typography.bodySmall} mt-6 inline-block ${textColor.secondary} underline underline-offset-4 hover:text-foreground`}>
          Go to My Activities
        </Link>
      </div>
    </main>
  );
}
