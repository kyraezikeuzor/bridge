"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Plus, Tag, Trash2 } from "lucide-react";
import { Badge, Button } from "@omelora/sunrise";
import type { ClaimedActivity, HoursRequest } from "@/lib/airtable";
import { MAX_PROOF_FILE_BYTES, MAX_PROOF_FILES } from "@/lib/activityCompletion";
import { textColor, typography } from "@/styles/typography";

type Draft = { batchId: string; letters: string[]; completedDate: string; notes: string; photoPermissions: boolean };
const field = "mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const freshDraft = (): Draft => ({ batchId: crypto.randomUUID(), letters: ["", "", ""], completedDate: localToday(), notes: "", photoPermissions: false });
const instructionUrl = /https?:\/\/[^\s]+/g;

function Instructions({ value }: { value: string }) {
  const steps = value.split(/\r?\n/).map((step) => step.trim().replace(/^[-•\d.)\s]+/, "")).filter(Boolean);
  return <details className="mt-5 rounded-xl bg-muted/50 px-5 py-4" open>
    <summary className={`${typography.cardTitle} cursor-pointer text-foreground`}>Instructions</summary>
    <ol className={`mt-3 list-decimal space-y-2 pl-5 ${typography.bodySmall} text-foreground`}>{steps.map((step, index) => {
      const urls = step.match(instructionUrl) ?? [];
      return <li key={index} className="[overflow-wrap:anywhere]">{step.split(instructionUrl).map((part, partIndex) => <span key={partIndex}>{part}{urls[partIndex] && <a href={urls[partIndex]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary">{urls[partIndex]}</a>}</span>)}</li>;
    })}</ol>
  </details>;
}

function History({ hours }: { hours: HoursRequest[] }) {
  const finalized = hours.filter((row) => row.status !== "Draft");
  if (!finalized.length) return null;
  return <section className="mt-8 border-t border-border pt-6"><h2 className={typography.sectionTitle}>Previous batches</h2><div className="mt-4 space-y-3">{finalized.map((row) => <article key={row.id} className="rounded-lg border border-border px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-foreground">{row.workType === "Letter Writing" ? `${row.quantity ?? row.submissions.length} letters` : "Photo proof"} · {row.requestedHours ?? row.hoursRequested ?? 0} hours</p><Badge variant={row.status === "Approved" ? "success" : row.status === "Rejected" ? "destructive" : "warning"}>{row.status === "Rejected" ? "Needs changes" : row.status === "Submitted" ? "Submitted for review" : row.status}</Badge></div>{row.reviewNotes && <p className={`mt-2 whitespace-pre-wrap ${typography.bodySmall} ${textColor.secondary}`}>{row.reviewNotes}</p>}</article>)}</div></section>;
}

export function ActivityBody({ claim, hours, loading, onSubmitted }: { claim?: ClaimedActivity; hours: HoursRequest[]; loading: boolean; onSubmitted: (hours: HoursRequest) => void }) {
  const activity = claim?.activity;
  const personId = claim?.personId || "";
  const storageKey = `bridge-completion:${personId}:${claim?.id || ""}`;
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ready, setReady] = useState(false);
  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  useEffect(() => {
    if (!personId || !claim?.id) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Draft;
        if (parsed.batchId && Array.isArray(parsed.letters)) setDraft(parsed);
      }
    } catch { /* A damaged local draft does not block the form. */ }
    setReady(true);
  }, [personId, claim?.id, storageKey]);
  useEffect(() => {
    if (ready && personId) localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, ready, personId, storageKey]);

  if (!claim || !activity) return <p className="rounded-xl border-2 border-border p-6">{loading ? "Loading your activity…" : "This activity is unavailable."}</p>;
  const mode = activity.completionWorkflow;
  const draftHours = hours.find((row) => row.status === "Draft" && row.workReference === `BridgeBatch:${claim.id}:${draft.batchId}`);
  const completedLetters = draft.letters.filter((letter) => letter.trim()).length;
  const batchSize = mode === "Letters" ? Math.floor(completedLetters / 3) * 3 : 0;
  const canSubmitLetters = batchSize >= 3 && draft.letters.slice(0, batchSize).every((letter) => letter.trim());
  const formError = mode === "Letters" ? (canSubmitLetters ? "" : "Write at least three complete letters to submit a batch.") : (files.length || draftHours?.proofFiles.length ? "" : "Add at least one proof picture.");

  const submit = async () => {
    if (formError) { setError(formError); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = { batchId: draft.batchId, mode, completedDate: draft.completedDate, notes: draft.notes, photoPermissions: String(draft.photoPermissions), confirmation: String(confirmed) };
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (mode === "Letters") {
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ ...payload, letters: draft.letters.slice(0, batchSize) });
      } else {
        const form = new FormData();
        Object.entries(payload).forEach(([key, value]) => form.set(key, value));
        files.forEach((file) => form.append("proof", file));
        body = form;
      }
      const response = await fetch(`/api/person-activities/${encodeURIComponent(claim.id)}/complete`, { method: "POST", headers, body });
      const result = await response.json() as { hours?: HoursRequest; error?: string };
      if (!response.ok || !result.hours) throw new Error(result.error || "Could not submit your work. Please try again.");
      onSubmitted(result.hours);
      setSuccess(mode === "Letters"
        ? "Thank you for volunteering! Your letters have been sent for review. You can write more whenever you're ready."
        : "Thank you for volunteering! Your photos have been sent for review. Come back anytime to share more completed work.");
      const remaining = mode === "Letters" ? draft.letters.slice(batchSize) : [];
      setDraft({ ...freshDraft(), letters: remaining.length >= 3 ? remaining : [...remaining, ...Array(3 - remaining.length).fill("")] });
      setFiles([]);
      setConfirmed(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not submit your work. Please try again.");
    } finally { setBusy(false); }
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    if (next.length > MAX_PROOF_FILES || next.some((file) => file.size > MAX_PROOF_FILE_BYTES || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type))) {
      setError("Choose up to 10 JPG, PNG, WebP, or HEIC pictures under 10 MB each.");
      return;
    }
    setError("");
    setFiles(next);
  };

  return <div className="text-foreground"><header><h1 className={typography.pageTitle}>{activity.name}</h1>{activity.description && <p className={`mt-3 ${typography.body} text-foreground`}>{activity.description}</p>}</header>
    <div className={`mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-3 ${typography.metadata} ${textColor.secondary}`}><span className="inline-flex items-center gap-1.5"><Tag className="h-4 w-4" />{activity.track || "General"}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{mode === "Letters" ? "3 letters = 1 hour" : `${activity.hoursValue} hours per submission`}</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{activity.endDate ? `Due ${activity.endDate.slice(0, 10)}` : "No deadline"}</span></div>
    {activity.fields.Instructions?.trim() && <Instructions value={activity.fields.Instructions} />}
    <section className="mt-6 rounded-xl border-2 border-border bg-background p-5 sm:p-7"><div className="border-b border-border pb-5"><h2 className={typography.sectionTitle}>{mode === "Letters" ? "Write your letters" : "Submit proof pictures"}</h2><p className={`mt-2 ${typography.bodySmall} ${textColor.secondary}`}>{mode === "Letters" ? "Write each letter here. Submit complete groups of three; you can return to write another batch." : "Upload clear pictures of the work you completed. The hours value comes from this activity."}</p></div>
      {hours.some((row) => row.status === "Submitted") && <div className="mt-5 flex items-start gap-3 rounded-lg bg-amber-700 p-4 text-white"><Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><p className={typography.bodySmall}>{mode === "Letters" ? "Your letters are waiting for review. You're welcome to keep writing and send more letters whenever you're ready." : "Your volunteer work is waiting for review. If you've completed more work, you can share new photos below."}</p></div>}
      {mode === "Photo proof" && activity.hoursValue === 0 && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">This activity is currently set to 0 hours. Your pictures can still be reviewed, but the request will be for 0 hours unless a director adjusts the award.</p>}
      <div className="mt-6 space-y-5">
        {mode === "Letters" ? <><div className="space-y-5">{draft.letters.map((letter, index) => <div key={index}><div className="flex items-center justify-between gap-3"><label htmlFor={`letter-${index}`} className={typography.label}>Letter {index + 1}</label><button type="button" onClick={() => setDraft((current) => ({ ...current, letters: current.letters.filter((_, i) => i !== index) }))} disabled={draft.letters.length <= 3 || busy} aria-label={`Remove letter ${index + 1}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div><textarea id={`letter-${index}`} rows={7} maxLength={15000} value={letter} onChange={(event) => setDraft((current) => ({ ...current, letters: current.letters.map((value, i) => i === index ? event.target.value : value) }))} className={field} /></div>)}</div><Button type="button" variant="outline" onClick={() => setDraft((current) => ({ ...current, letters: [...current.letters, ""] }))} disabled={busy || draft.letters.length >= 30}><Plus className="mr-2 h-4 w-4" />Add letter</Button><p className={`${typography.bodySmall} font-medium text-foreground`}>{completedLetters} letters written · {batchSize / 3} hours ready to submit{completedLetters > batchSize ? ` · ${completedLetters - batchSize} letter saved for the next batch` : ""}</p></> : <><label className={typography.label} htmlFor="proof-files">Proof pictures</label><input id="proof-files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium`} />{(draftHours?.proofFiles.length || 0) > 0 && <p className={`${typography.bodySmall} text-foreground`}>{draftHours?.proofFiles.length} picture(s) already uploaded for this draft.</p>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{previews.map((preview, index) => <div key={preview.url} className="rounded-lg border border-border p-2"><img src={preview.url} alt={`Preview of ${preview.name}`} className="h-28 w-full rounded-md object-cover" /><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs">{preview.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${preview.name}`} className="rounded p-1 hover:bg-muted"><Trash2 className="h-4 w-4" /></button></div></div>)}</div><p className={`${typography.bodySmall} font-medium text-foreground`}>{activity.hoursValue} hours will be requested for this submission.</p><label className={`flex items-start gap-3 ${typography.bodySmall}`}><input type="checkbox" checked={draft.photoPermissions} onChange={(event) => setDraft((current) => ({ ...current, photoPermissions: event.target.checked }))} className="mt-1 accent-primary" />Omelora may use these pictures in impact updates. Optional.</label></>}
        <label className={`block ${typography.label}`}>Date completed<input type="date" required max={localToday()} value={draft.completedDate} onChange={(event) => setDraft((current) => ({ ...current, completedDate: event.target.value }))} className={field} /></label>
        <label className={`block ${typography.label}`}>Additional notes <span className={`${typography.helper} ${textColor.secondary}`}>(optional)</span><textarea rows={3} maxLength={5000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className={field} /></label>
        <label className={`flex items-start gap-3 ${typography.bodySmall}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-primary" /><span>I confirm this work is mine and the information is accurate.</span></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {success && <div role="status" className="flex items-start gap-3 rounded-lg bg-emerald-700 p-4 text-white"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><p className={typography.bodySmall}>{success}</p></div>}
        <Button type="button" variant="primary" size="lg" onClick={() => void submit()} disabled={busy || !confirmed || !draft.completedDate} className="min-h-11 w-full sm:w-auto">{busy ? "Submitting your work…" : "Submit activity for review"}</Button>
      </div>
    </section><History hours={hours} />
  </div>;
}
