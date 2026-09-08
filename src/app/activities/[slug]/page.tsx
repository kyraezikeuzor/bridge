"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw, X } from "lucide-react";
import { ActivityBody } from "@/components/activity/ActivityBody";
import { OwnershipAgreementDialog } from "@/components/activity/ActivityWorkspaces";
import { useToast } from "@/components/ToastProvider";
import type { ClaimedActivity, Contribution, Submission } from "@/lib/airtable";
import { useCachedResource } from "@/lib/useCachedResource";
import { typography } from "@/styles/typography";
import ActivitiesPage from "../page";

type ActivityResponse = {
  claim: ClaimedActivity;
  contributions: Contribution[];
  submissions: Submission[];
};

export default function ActivityViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { push: toast } = useToast();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const claimId = typeof slug === "string" ? slug : "";
  const [entryOpen, setEntryOpen] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateUrl, setCertificateUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [ownershipAgreed, setOwnershipAgreed] = useState(false);
  const { data, setData, loading, refreshing, refresh } = useCachedResource<ActivityResponse>(
    `my-activity:${claimId}`,
    async () => {
      const response = await fetch(`/api/person-activities/${encodeURIComponent(claimId)}`);
      if (!response.ok) throw new Error("Failed to load activity");
      return (await response.json()) as ActivityResponse;
    },
    { enabled: sessionStatus === "authenticated" && Boolean(claimId) }
  );
  const claim = data?.claim;
  const activity = claim?.activity;
  const submissions = data?.submissions ?? [];
  const target = activity?.submissionTarget ?? null;
  const finalized = (data?.contributions ?? []).some(
    (item) => item.status === "Submitted" || item.status === "Approved"
  );
  const closeWorkspace = useCallback(() => router.push("/activities"), [router]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWorkspace();
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLElement>("button, [href], input, textarea")?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeWorkspace]);

  const post = async (action: string, payload: Record<string, string> = {}) => {
    setSaving(true);
    try {
      const selectedFile = action === "submit-oppia-certificate" ? certificateFile : file;
      const hasFile = (action === "save-submission" || action === "submit-oppia-certificate") && selectedFile;
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (hasFile) {
        const form = new FormData();
        form.set("action", action);
        for (const [key, value] of Object.entries(payload)) form.set(key, value);
        form.set("file", selectedFile as File);
        body = form;
      } else {
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ action, ...payload });
      }
      const response = await fetch(`/api/person-activities/${encodeURIComponent(claimId)}`, { method: "POST", headers, body });
      if (!response.ok) throw new Error("Could not save your work");
      const result = await response.json();
      if (result.submission) setData((previous) => previous ? { ...previous, submissions: [...previous.submissions, result.submission] } : previous);
      if (result.contribution) setData((previous) => previous ? { ...previous, contributions: [result.contribution, ...previous.contributions] } : previous);
      setContent("");
      setFile(null);
      setCertificateFile(null);
      setCertificateUrl("");
      setNotes("");
      setEntryOpen(false);
      toast(action === "save-submission" ? "Your submission was saved." : "Your work has been sent for hours review.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save your work", "error");
    } finally {
      setSaving(false);
    }
  };

  const finalize = () => {
    if (target && submissions.length < target) {
      toast(`Please submit all ${target} required submissions before requesting hours.`, "error");
      return;
    }
    if (!submissions.length) {
      toast("Save at least one submission before requesting hours.", "error");
      return;
    }
    setOwnershipAgreed(false);
    setAgreementOpen(true);
  };

  return <><div className="fixed inset-0 overflow-hidden" aria-hidden="true"><ActivitiesPage /></div><main className="relative z-50 min-h-screen bg-black/35 sm:p-4"><dialog open aria-label="Activity workspace" className="mx-auto w-full max-w-6xl border-2 border-[#CFCFCF] bg-background p-5 text-foreground shadow-2xl sm:rounded-2xl sm:p-6"><div ref={workspaceRef} className="mx-auto flex w-full max-w-5xl flex-col gap-5"><div className="flex items-center justify-between gap-4"><button type="button" onClick={closeWorkspace} className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 ${typography.button} ${typography.buttonSecondary}`}><X className="h-4 w-4" />Close</button><button type="button" onClick={() => void refresh()} disabled={loading || refreshing} className={`inline-flex h-9 items-center rounded-md px-3 ${typography.button} ${typography.buttonSecondary}`}><RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button></div><ActivityBody loading={loading || sessionStatus === "loading"} activity={activity} claim={claim} submissions={submissions} target={target} content={content} file={file} entryOpen={entryOpen} saving={saving} finalized={finalized} certificateFile={certificateFile} certificateUrl={certificateUrl} notes={notes} onContent={setContent} onFile={setFile} onEntryOpen={setEntryOpen} onCertificateFile={setCertificateFile} onCertificateUrl={setCertificateUrl} onNotes={setNotes} onSave={() => void post("save-submission", { content })} onFinalize={finalize} onOppia={() => void post("submit-oppia-certificate", { certificateUrl, notes })} /></div></dialog></main>{agreementOpen ? <OwnershipAgreementDialog agreed={ownershipAgreed} onAgreedChange={setOwnershipAgreed} onCancel={() => setAgreementOpen(false)} onConfirm={() => { setAgreementOpen(false); void post("finalize-submissions", { ownershipAgreement: "true" }); }} /> : null}</>;
}
