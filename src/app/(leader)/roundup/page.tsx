"use client";

import { useState } from "react";
import { AudiencePanel, RecipientsPanel, ResultsPanel, SendPanel } from "@/components/roundup/RoundupPanels";
import type { Audience, Recipient, RunSummary } from "@/components/roundup/types";
import { useToast } from "@/components/ToastProvider";

export default function RoundupPage() {
  const { push: toast } = useToast();
  const [audience, setAudience] = useState<Audience>("all-volunteers");
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const chooseAudience = (next: Audience) => {
    setAudience(next);
    setRecipients(null);
    setSummary(null);
  };
  const preview = async () => {
    setLoading(true);
    setSummary(null);
    try {
      const response = await fetch(`/api/roundup?audience=${encodeURIComponent(audience)}`);
      if (!response.ok) throw new Error("Failed to load recipients");
      const body = await response.json();
      setRecipients(body.recipients as Recipient[]);
    } catch (error) {
      setRecipients(null);
      toast(error instanceof Error ? error.message : "Failed to load recipients", "error");
    } finally {
      setLoading(false);
    }
  };
  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const response = await fetch("/api/roundup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, dryRun, ...(dryRun ? {} : { confirm }) }),
      });
      if (!response.ok) throw new Error("Roundup failed");
      const body = (await response.json()) as RunSummary;
      setSummary(body);
      if (!dryRun) setConfirm("");
      toast(dryRun ? `Dry run OK — ${body.total} recipient(s), nothing sent` : `Sent ${body.sent} of ${body.total}`, body.failed ? "error" : "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Roundup failed", "error");
    } finally {
      setRunning(false);
    }
  };
  const busy = loading || running;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header><h1 className="text-3xl font-semibold tracking-normal text-[#3F3F3F] sm:text-4xl">Volunteer Roundup</h1><p className="mt-2 text-sm text-muted-foreground">Re-sends the welcome email leading with the corrected Discord invite.</p></header>
      <AudiencePanel audience={audience} busy={busy} loading={loading} onAudience={chooseAudience} onPreview={() => void preview()} />
      {recipients ? <RecipientsPanel recipients={recipients} busy={busy} running={running} onDryRun={() => void run(true)} /> : null}
      {recipients?.length ? <SendPanel count={recipients.length} confirm={confirm} busy={busy} running={running} onConfirm={setConfirm} onSend={() => void run(false)} /> : null}
      {summary ? <ResultsPanel summary={summary} /> : null}
    </div>
  );
}
