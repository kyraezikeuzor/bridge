import { CalendarDays, Check, Clock3, ExternalLink, Link2, Plus, Tag, Zap } from "lucide-react";
import { Badge, Card, CardContent } from "@omelora/sunrise";
import { AttachmentFileUploader } from "@/components/AttachmentFileUploader";
import type { ClaimedActivity, Submission } from "@/lib/airtable";
import { textColor, typography } from "@/styles/typography";
import { Detail, ExternalWorkspace, OppiaWorkspace } from "./ActivityWorkspaces";

type Activity = NonNullable<ClaimedActivity["activity"]>;
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const URL_PATTERN = /https?:\/\/[^\s]+/g;

function formatDate(value: string | null | undefined) {
  return value ? DATE_FORMAT.format(new Date(value)) : null;
}

function Instructions({ value }: { value: string }) {
  const steps = value.split(/\r?\n/).map((step) => step.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
  return <section className="mt-5"><h2 className={typography.sectionTitle}>Instructions</h2><ol className={`mt-2 list-decimal space-y-1.5 pl-5 ${typography.body} ${textColor.secondary}`}>{steps.map((step) => {
    const urls = step.match(URL_PATTERN) ?? [];
    return <li key={step}>{step.split(URL_PATTERN).map((text, index) => <span key={`${text}-${urls[index] ?? "end"}`}>{text}{urls[index] ? <a href={urls[index]} target="_blank" rel="noreferrer" aria-label="Open instruction link" className="ml-1 inline-flex align-middle text-primary hover:opacity-75"><Link2 className="h-4 w-4" /></a> : null}</span>)}</li>;
  })}</ol></section>;
}

type SubmissionPanelProps = {
  submissions: Submission[];
  target: number | null;
  submissionFormat: string | null;
  content: string;
  file: File | null;
  entryOpen: boolean;
  saving: boolean;
  finalized: boolean;
  onContent: (value: string) => void;
  onFile: (file: File | null) => void;
  onEntryOpen: (open: boolean) => void;
  onSave: () => void;
  onFinalize: () => void;
};

function SubmissionPanel(props: SubmissionPanelProps) {
  const { submissions, target, submissionFormat, content, file, entryOpen, saving, finalized, onContent, onFile, onEntryOpen, onSave, onFinalize } = props;
  const reachedTarget = !target || submissions.length >= target;
  const acceptsText = submissionFormat === "Text";
  const acceptsFile = submissionFormat === "File";
  const canSave = acceptsText ? Boolean(content.trim()) : acceptsFile ? Boolean(file) : false;
  return <Card variant="outline" className="border-2"><CardContent className="p-0">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className={typography.sectionTitle}>Your Progress</h2><p className={`mt-1 ${typography.metadata} ${textColor.secondary}`}>{target ? `${submissions.length} of ${target} submissions saved` : `${submissions.length} submission${submissions.length === 1 ? "" : "s"} saved`}</p></div><Badge variant={reachedTarget ? "success" : "outline"}>{reachedTarget ? "Ready to submit" : `${Math.max((target || 0) - submissions.length, 0)} remaining`}</Badge></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{submissions.map((submission, index) => <div key={submission.id} className="rounded-lg border border-border bg-muted/20 p-4"><div className={`flex items-center gap-2 ${typography.cardTitle}`}><Check className="h-4 w-4 text-primary" />Submission {index + 1} saved</div>{submission.content ? <p className={`mt-2 line-clamp-3 whitespace-pre-wrap ${typography.bodySmall} ${textColor.secondary}`}>{submission.content}</p> : null}{submission.files[0] ? <a href={submission.files[0].url} target="_blank" rel="noreferrer" className={`mt-2 inline-flex ${typography.button} text-primary hover:underline`}>View PDF <ExternalLink className="ml-1 h-3.5 w-3.5" /></a> : null}</div>)}{(!target || submissions.length < target) ? <button type="button" onClick={() => onEntryOpen(true)} className={`flex min-h-28 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border ${typography.button} hover:border-[#9A9A9A] hover:bg-muted/50`}><Plus className="h-4 w-4" />Add submission</button> : null}</div>
    {!finalized ? <button type="button" disabled={saving} onClick={onFinalize} className={`mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 ${typography.button} text-primary-foreground disabled:opacity-50`}>{saving ? "Saving…" : "Submit & Request Hours"}</button> : <p className={`mt-5 ${typography.metadata} font-medium text-primary`}>Submitted for hours review.</p>}
    {entryOpen ? <div className="mt-6 rounded-xl border-2 border-primary/30 bg-muted/20 p-5"><div className="flex items-center justify-between gap-3"><h3 className={typography.cardTitle}>Add submission</h3><button type="button" onClick={() => onEntryOpen(false)} className={`${typography.button} ${textColor.secondary}`}>Cancel</button></div>{acceptsText ? <label className={`mt-4 block ${typography.label}`}>Submission text<textarea value={content} onChange={(event) => onContent(event.target.value)} rows={8} maxLength={15000} className={`mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 ${typography.bodySmall}`} /></label> : null}{acceptsFile ? <AttachmentFileUploader file={file} onChange={onFile} /> : null}{!submissionFormat ? <p className={`mt-4 ${typography.bodySmall} text-destructive`}>This activity needs a submission format before work can be added.</p> : null}<button type="button" disabled={saving || !canSave} onClick={onSave} className={`mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 ${typography.button} text-primary-foreground disabled:opacity-50`}>{saving ? "Saving…" : "Save submission"}</button></div> : null}
  </CardContent></Card>;
}

type ActivityBodyProps = {
  loading: boolean;
  activity?: Activity | null;
  claim?: ClaimedActivity;
  submissions: Submission[];
  target: number | null;
  content: string;
  file: File | null;
  entryOpen: boolean;
  saving: boolean;
  finalized: boolean;
  certificateFile: File | null;
  certificateUrl: string;
  notes: string;
  onContent: (value: string) => void;
  onFile: (file: File | null) => void;
  onEntryOpen: (open: boolean) => void;
  onCertificateFile: (file: File | null) => void;
  onCertificateUrl: (value: string) => void;
  onNotes: (value: string) => void;
  onSave: () => void;
  onFinalize: () => void;
  onOppia: () => void;
};

function WorkPanel(props: ActivityBodyProps & { activity: Activity }) {
  const { activity } = props;
  if (activity.type === "Submission" && activity.platform === "Bridge") return <SubmissionPanel submissions={props.submissions} target={props.target} submissionFormat={activity.submissionFormat} content={props.content} file={props.file} entryOpen={props.entryOpen} saving={props.saving} finalized={props.finalized} onContent={props.onContent} onFile={props.onFile} onEntryOpen={props.onEntryOpen} onSave={props.onSave} onFinalize={props.onFinalize} />;
  if (activity.platform === "Oppia") return <OppiaWorkspace activity={activity} certificateFile={props.certificateFile} certificateUrl={props.certificateUrl} notes={props.notes} saving={props.saving} onCertificateFile={props.onCertificateFile} onCertificateUrl={props.onCertificateUrl} onNotes={props.onNotes} onSubmit={props.onOppia} />;
  if (activity.platform === "Monsoon") return <ExternalWorkspace title="Complete this work in Monsoon" copy="This project is completed in Monsoon. Bridge will receive the summarized contribution when syncing is enabled." activity={activity} />;
  if (activity.type === "Attendance") return <ExternalWorkspace title="Attendance" copy="You are registered. Attendance will be confirmed by staff after the event; no submission or hours request is needed." activity={activity} />;
  return <ExternalWorkspace title="Participation" copy="Follow the instructions to complete this participation task. Bridge will show its appropriate completion step here as the workflow is configured." activity={activity} />;
}

export function ActivityBody(props: ActivityBodyProps) {
  if (props.loading) return <div className="space-y-4"><div className="h-40 animate-pulse rounded-xl bg-muted/60" /><div className="h-64 animate-pulse rounded-xl bg-muted/60" /></div>;
  if (!props.claim || !props.activity) return <Card variant="outline" className="border-2 border-dashed"><CardContent className="p-0"><h1 className={typography.sectionTitle}>Activity unavailable</h1><p className={`mt-2 ${typography.bodySmall} ${textColor.secondary}`}>This activity is not available in your claims.</p></CardContent></Card>;
  const activity = props.activity;
  return <div><section><h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{activity.name}</h1>{activity.description ? <p className={`mt-4 max-w-3xl ${typography.body} ${textColor.secondary}`}>{activity.description}</p> : null}</section><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-2.5"><Detail icon={Tag} label="Track" value={activity.track || "General"} /><Detail icon={Clock3} label="Hours" value={`${activity.hoursValue} hours`} />{activity.type === "Submission" && props.target ? <Detail icon={Zap} label="Target" value={`${props.target} submission${props.target === 1 ? "" : "s"}`} /> : null}<Detail icon={CalendarDays} label="Deadline" value={formatDate(activity.endDate) || formatDate(activity.startDate) || "No deadline"} /></div>{activity.fields.Instructions?.trim() ? <Instructions value={activity.fields.Instructions} /> : null}<section className="mt-5 border-t border-border pt-5"><WorkPanel {...props} activity={activity} /></section></div>;
}
