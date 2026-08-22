"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";

type Audience = "affected" | "all-volunteers";

type Recipient = {
  email: string;
  firstName: string;
  personId: string | null;
  matched: boolean;
};

type SendResult = {
  email: string;
  status: "sent" | "skipped" | "failed";
  detail?: string;
};

type RunSummary = {
  dryRun: boolean;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: SendResult[];
};

const CONFIRM_PHRASE = "SEND ROUNDUP";

const AUDIENCE_LABELS: Record<Audience, string> = {
  "all-volunteers": "All volunteers on the roster",
  affected: "Only the 38 who received the dead invite",
};

const STATUS_STYLES: Record<SendResult["status"], string> = {
  sent: "text-emerald-700",
  failed: "text-red-700",
  skipped: "text-muted-foreground",
};

export default function RoundupPage() {
  const { push: toast } = useToast();

  const [audience, setAudience] = useState<Audience>("all-volunteers");
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const loadPreview = async (next: Audience) => {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch(
        `/api/roundup?audience=${encodeURIComponent(next)}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load recipients");
      setRecipients(body.recipients as Recipient[]);
    } catch (err) {
      console.error("[roundup]", err);
      setRecipients(null);
      toast(
        err instanceof Error ? err.message : "Failed to load recipients",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const res = await fetch("/api/roundup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          dryRun,
          ...(dryRun ? {} : { confirm: confirmText }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Roundup failed");

      setSummary(body as RunSummary);
      if (dryRun) {
        toast(`Dry run OK — ${body.total} recipient(s), nothing sent`);
      } else {
        setConfirmText("");
        toast(`Sent ${body.sent} of ${body.total}`, body.failed ? "error" : "success");
      }
    } catch (err) {
      console.error("[roundup]", err);
      toast(err instanceof Error ? err.message : "Roundup failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const armed = confirmText.trim() === CONFIRM_PHRASE;
  const busy = loading || running;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-[#3F3F3F] sm:text-4xl">
          Volunteer Roundup
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Re-sends the welcome email leading with the corrected Discord invite.
        </p>
      </div>

      {/* Audience */}
      <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6">
        <p className="text-sm font-medium text-foreground">Who gets this</p>
        {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((key) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="audience"
              value={key}
              checked={audience === key}
              disabled={busy}
              onChange={() => {
                setAudience(key);
                setRecipients(null);
                setSummary(null);
              }}
            />
            {AUDIENCE_LABELS[key]}
          </label>
        ))}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadPreview(audience)}
            disabled={busy}
          >
            Preview recipients
            <RefreshCw
              className={`ml-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Recipients */}
      {recipients ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6">
          <p className="text-sm font-medium text-foreground">
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            {recipients.some((r) => !r.firstName) ? (
              <span className="ml-2 font-normal text-muted-foreground">
                ({recipients.filter((r) => !r.firstName).length} with no name on
                file — greeted as &ldquo;there&rdquo;, and the subject drops the
                name)
              </span>
            ) : null}
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.email} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{r.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.firstName || <em>no name on file</em>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {r.matched ? "" : "unmatched"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => run(true)}
              disabled={busy}
            >
              {running ? "Running..." : "Dry run"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Live send */}
      {recipients && recipients.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-foreground">
              This emails {recipients.length} real{" "}
              {recipients.length === 1 ? "person" : "people"} and cannot be
              undone. Run a dry run first. Type{" "}
              <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span>{" "}
              to unlock.
            </p>
          </div>

          <Input
            label="Confirmation"
            name="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={busy}
          />

          <div>
            <Button
              type="button"
              variant="primary"
              onClick={() => run(false)}
              disabled={busy || !armed}
            >
              {running ? "Sending..." : `Send to ${recipients.length}`}
              <Send className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Results */}
      {summary ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6">
          <p className="text-sm font-medium text-foreground">
            {summary.dryRun ? "Dry run" : "Send"} results — {summary.sent} sent,{" "}
            {summary.failed} failed, {summary.skipped} skipped
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <tbody>
                {summary.results.map((r) => (
                  <tr key={r.email} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{r.email}</td>
                    <td
                      className={`px-3 py-2 font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.detail ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
