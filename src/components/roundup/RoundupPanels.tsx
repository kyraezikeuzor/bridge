import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { CONFIRM_PHRASE, type Audience, type Recipient, type RunSummary, type SendResult } from "./types";

const AUDIENCES: Record<Audience, string> = { "all-volunteers": "All volunteers on the roster", affected: "Only the 38 who received the dead invite" };
const STATUS_STYLES: Record<SendResult["status"], string> = { sent: "text-emerald-700", failed: "text-red-700", skipped: "text-muted-foreground" };

export function AudiencePanel({ audience, busy, loading, onAudience, onPreview }: { audience: Audience; busy: boolean; loading: boolean; onAudience: (audience: Audience) => void; onPreview: () => void }) {
  return <section className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6"><p className="text-sm font-medium text-foreground">Who gets this</p>{(Object.keys(AUDIENCES) as Audience[]).map((key) => <label key={key} className="flex items-center gap-3 text-sm"><input type="radio" name="audience" value={key} checked={audience === key} disabled={busy} onChange={() => onAudience(key)} />{AUDIENCES[key]}</label>)}<div className="pt-2"><Button type="button" variant="outline" onClick={onPreview} disabled={busy}>Preview recipients <RefreshCw className={`ml-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div></section>;
}

export function RecipientsPanel({ recipients, busy, running, onDryRun }: { recipients: Recipient[]; busy: boolean; running: boolean; onDryRun: () => void }) {
  const unnamed = recipients.reduce((count, recipient) => count + (recipient.firstName ? 0 : 1), 0);
  return <section className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6"><p className="text-sm font-medium text-foreground">{recipients.length} recipient{recipients.length === 1 ? "" : "s"}{unnamed ? <span className="ml-2 font-normal text-muted-foreground">({unnamed} with no name on file)</span> : null}</p><div className="max-h-72 overflow-y-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><tbody>{recipients.map((recipient) => <tr key={recipient.email} className="border-b border-border last:border-0"><td className="px-3 py-2 text-foreground">{recipient.email}</td><td className="px-3 py-2 text-muted-foreground">{recipient.firstName || <em>no name on file</em>}</td><td className="px-3 py-2 text-right text-xs text-muted-foreground">{recipient.matched ? "" : "unmatched"}</td></tr>)}</tbody></table></div><div className="pt-2"><Button type="button" variant="outline" onClick={onDryRun} disabled={busy}>{running ? "Running..." : "Dry run"}</Button></div></section>;
}

export function SendPanel({ count, confirm, busy, running, onConfirm, onSend }: { count: number; confirm: string; busy: boolean; running: boolean; onConfirm: (value: string) => void; onSend: () => void }) {
  return <section className="flex flex-col gap-4 rounded-xl border-2 border-red-200 bg-red-50/50 p-6"><div className="flex items-start gap-2.5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><p className="text-sm text-foreground">This emails {count} real {count === 1 ? "person" : "people"} and cannot be undone. Run a dry run first. Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to unlock.</p></div><Input label="Confirmation" name="confirm" value={confirm} onChange={(event) => onConfirm(event.target.value)} placeholder={CONFIRM_PHRASE} disabled={busy} /><div><Button type="button" variant="primary" onClick={onSend} disabled={busy || confirm.trim() !== CONFIRM_PHRASE}>{running ? "Sending..." : `Send to ${count}`}<Send className="ml-1.5 h-4 w-4" /></Button></div></section>;
}

export function ResultsPanel({ summary }: { summary: RunSummary }) {
  return <section className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-6"><p className="text-sm font-medium text-foreground">{summary.dryRun ? "Dry run" : "Send"} results — {summary.sent} sent, {summary.failed} failed, {summary.skipped} skipped</p><div className="max-h-72 overflow-y-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><tbody>{summary.results.map((result) => <tr key={result.email} className="border-b border-border last:border-0"><td className="px-3 py-2 text-foreground">{result.email}</td><td className={`px-3 py-2 font-medium ${STATUS_STYLES[result.status]}`}>{result.status}</td><td className="px-3 py-2 text-xs text-muted-foreground">{result.detail ?? ""}</td></tr>)}</tbody></table></div></section>;
}
