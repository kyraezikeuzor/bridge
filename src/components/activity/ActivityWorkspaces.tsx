import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { AttachmentFileUploader } from "@/components/AttachmentFileUploader";
import type { ClaimedActivity } from "@/lib/airtable";
import { textColor, typography } from "@/styles/typography";

type Activity = NonNullable<ClaimedActivity["activity"]>;

export function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-muted-foreground" /><span className={`${typography.status} uppercase ${textColor.subtle}`}>{label}</span><span className={`${typography.metadata} ${textColor.secondary}`}>{value}</span></div>;
}

export function OwnershipAgreementDialog({ agreed, onAgreedChange, onCancel, onConfirm }: { agreed: boolean; onAgreedChange: (agreed: boolean) => void; onCancel: () => void; onConfirm: () => void }) {
  return <dialog open aria-labelledby="ownership-agreement-title" className="fixed inset-0 z-[60] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-black/45 p-4 text-foreground"><div className="w-full max-w-2xl rounded-2xl border-2 border-border bg-background p-6 shadow-2xl"><h2 id="ownership-agreement-title" className={typography.sectionTitle}>Ownership agreement</h2><div className={`mt-4 max-h-[50vh] overflow-y-auto rounded-xl bg-muted/50 p-4 ${typography.bodySmall} ${textColor.secondary}`}><p>I certify that these submissions are my own original work. I assign the intellectual property rights and ownership of these designs to Omelora so they may be used, sold, or distributed to nonprofit and school partners in support of its mission.</p><p className="mt-3">Omelora may also use these designs for educational programs, chapter mentorship sessions, and its learning library. In return, I will receive verified volunteer hours and professional credit for my work. I may still include these designs in my personal portfolio.</p></div><label className={`mt-5 flex cursor-pointer items-start gap-3 ${typography.bodySmall}`}><input type="checkbox" checked={agreed} onChange={(event) => onAgreedChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-primary" /><span>I have read and agree to this ownership agreement.</span></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className={`inline-flex h-10 items-center rounded-md px-4 ${typography.button} ${typography.buttonSecondary}`}>Cancel</button><button type="button" disabled={!agreed} onClick={onConfirm} className={`inline-flex h-10 items-center rounded-md bg-primary px-4 ${typography.button} text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50`}>I agree and submit</button></div></div></dialog>;
}

export function ExternalWorkspace({ title, copy, activity }: { title: string; copy: string; activity: Activity }) {
  return <Card variant="outline" className="border-2"><CardContent className="p-0"><h2 className={typography.sectionTitle}>{title}</h2><p className={`mt-2 ${typography.bodySmall} ${textColor.secondary}`}>{copy}</p>{activity.externalProjectUrl ? <a href={activity.externalProjectUrl} target="_blank" rel="noreferrer" className={`mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 ${typography.button} text-primary-foreground`}>Open in {activity.platform}<ExternalLink className="ml-1.5 h-4 w-4" /></a> : null}</CardContent></Card>;
}

type OppiaWorkspaceProps = {
  activity: Activity;
  certificateFile: File | null;
  certificateUrl: string;
  notes: string;
  saving: boolean;
  onCertificateFile: (file: File | null) => void;
  onCertificateUrl: (value: string) => void;
  onNotes: (value: string) => void;
  onSubmit: () => void;
};

export function OppiaWorkspace({ activity, certificateFile, certificateUrl, notes, saving, onCertificateFile, onCertificateUrl, onNotes, onSubmit }: OppiaWorkspaceProps) {
  return <Card variant="outline" className="border-2"><CardContent className="p-0"><h2 className={typography.sectionTitle}>Complete in Oppia</h2><p className={`mt-2 ${typography.bodySmall} ${textColor.secondary}`}>Finish the assigned work in Oppia, then upload your certificate for hours verification.</p>{activity.externalProjectUrl ? <a href={activity.externalProjectUrl} target="_blank" rel="noreferrer" className={`mt-3 inline-flex ${typography.button} text-primary hover:underline`}>Open Oppia <ExternalLink className="ml-1 inline h-3.5 w-3.5" /></a> : null}<AttachmentFileUploader file={certificateFile} onChange={onCertificateFile} /><label className={`mt-4 block ${typography.label}`}>Certificate URL <span className={`${typography.metadata} ${textColor.secondary}`}>(optional alternative)</span><input type="url" value={certificateUrl} onChange={(event) => onCertificateUrl(event.target.value)} className={`mt-1.5 h-10 w-full rounded-md border border-input px-3 ${typography.bodySmall}`} placeholder="https://…" /></label><label className={`mt-3 block ${typography.label}`}>Notes <span className={`${typography.metadata} ${textColor.secondary}`}>(optional)</span><textarea value={notes} onChange={(event) => onNotes(event.target.value)} rows={3} className={`mt-1.5 w-full rounded-md border border-input px-3 py-2 ${typography.bodySmall}`} /></label><button type="button" disabled={saving || (!certificateFile && !certificateUrl.trim())} onClick={onSubmit} className={`mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 ${typography.button} text-primary-foreground disabled:opacity-50`}>{saving ? "Submitting…" : "Submit certificate & request hours"}</button></CardContent></Card>;
}
