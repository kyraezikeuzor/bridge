export type Audience = "affected" | "all-volunteers";
export type Recipient = { email: string; firstName: string; personId: string | null; matched: boolean };
export type SendResult = { email: string; status: "sent" | "skipped" | "failed"; detail?: string };
export type RunSummary = { dryRun: boolean; total: number; sent: number; failed: number; skipped: number; results: SendResult[] };
export const CONFIRM_PHRASE = "SEND ROUNDUP";
