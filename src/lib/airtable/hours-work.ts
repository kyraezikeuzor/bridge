import { escapeFormulaString, listAllRecords, reserveRecord, updateRecord } from "./client";
import { fetchHoursForPerson, mapHoursRecord, type HoursFields, type HoursRequest } from "./hours";
import type { Activity } from "./activities";
import { hoursBelongsToClaim } from "../workReview";
import { fetchSubmissionsForClaim } from "./submissions";

type ClaimReference = { id: string; activityId: string | null; isLegacySignUp: boolean };

export async function fetchHoursForClaim(personId: string, claim: ClaimReference) {
  return (await fetchHoursForPerson(personId)).filter((row) => hoursBelongsToClaim(row, claim))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Reviewed evidence is immutable history; a rejected request starts fresh drafts. */
export async function fetchWorkingSubmissionsForClaim(personId: string, claim: ClaimReference, hours?: HoursRequest[]) {
  const requests = hours ?? await fetchHoursForClaim(personId, claim);
  const finalized = requests.find((row) => row.status === "Approved") || requests.find((row) => row.status === "Submitted");
  if (finalized) return finalized.submissions;
  const used = new Set(requests.flatMap((row) => row.submissionIds));
  return (await fetchSubmissionsForClaim(personId, claim)).filter((submission) => !used.has(submission.id));
}

export async function findHoursByWorkReference(reference: string): Promise<HoursRequest | null> {
  const records = await listAllRecords<HoursFields>("Hours", {
    filterByFormula: `{Work Reference}='${escapeFormulaString(reference)}'`,
  });
  if (records.length > 1) throw new Error("Duplicate work reference requires a data review");
  return records[0] ? mapHoursRecord(records[0]) : null;
}

/** Also find externally identified work migrated from historical Contributions. */
export async function findHoursByExternalReference(reference: string): Promise<HoursRequest | null> {
  const records = await listAllRecords<HoursFields>("Hours", {
    filterByFormula: `{External Reference}='${escapeFormulaString(reference)}'`,
  });
  if (records.length > 1) throw new Error("Duplicate external reference requires a data review");
  return records[0] ? mapHoursRecord(records[0]) : null;
}

// Stops duplicate finalization/upload requests within this server instance.
// Airtable upsert reserves the same key across instances; it is not a transaction.
const workInFlight = new Map<string, Promise<HoursRequest>>();
export async function coalesceHoursWork(key: string, action: () => Promise<HoursRequest>) {
  const existing = workInFlight.get(key);
  if (existing) return existing;
  const pending = action();
  workInFlight.set(key, pending);
  try { return await pending; } finally { if (workInFlight.get(key) === pending) workInFlight.delete(key); }
}

const reviewTails = new Map<string, Promise<void>>();
/** Serialize conflicting review decisions on one Hours record within this instance. */
export async function serializeHoursReview<T>(id: string, action: () => Promise<T>): Promise<T> {
  const previous = reviewTails.get(id) ?? Promise.resolve();
  const pending = previous.then(action);
  const tail = pending.then(() => undefined, () => undefined);
  reviewTails.set(id, tail);
  try { return await pending; } finally { if (reviewTails.get(id) === tail) reviewTails.delete(id); }
}

/** Airtable may default a newly reserved Hours row to Submitted before it contains work. */
export function hasFinalizedHoursWork(fields: HoursFields): boolean {
  const status = fields.Status?.trim();
  if (status === "Approved" || status === "Rejected") return true;
  return status === "Submitted" && Boolean(
    fields["Submitted Date"] || fields["Requested Hours"] != null || fields.Hours != null ||
    (fields["Linked Submissions"]?.length ?? 0) > 0
  );
}

/** Finalize directly into Hours; existing reviewed records are never reset. */
export async function createWorkHours(input: {
  personId: string;
  claim: ClaimReference;
  activity: Activity;
  reference: string;
  submissionIds?: string[];
  quantity?: number;
  notes?: string;
  proofLink?: string;
  ownershipAgreement?: boolean;
  startedAt?: string;
  completedAt?: string;
  verifiedHours?: number | null;
  externalReference?: string;
  approved?: boolean;
  requestedHours?: number;
  completedDate?: string;
  workType?: string;
  photoPermissions?: boolean;
}): Promise<HoursRequest> {
  if (!input.claim.activityId || input.claim.activityId !== input.activity.id) throw new Error("Work must belong to the claimed activity");
  const requestedHours = input.requestedHours ?? input.verifiedHours ?? input.activity.hoursValue;
  if (!Number.isFinite(requestedHours) || requestedHours < 0 || requestedHours > 1000) throw new Error("Invalid activity hours value");
  const reservation = await reserveRecord("Hours", "Work Reference", input.reference);
  const current = mapHoursRecord({ ...reservation, fields: reservation.fields as HoursFields });
  if (current.personIds.some((id) => id !== input.personId) || current.linkedActivityIds.some((id) => id !== input.activity.id)) {
    throw new Error("Work reference is associated with another person or activity");
  }
  if (hasFinalizedHoursWork(reservation.fields as HoursFields)) return current;

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    "Linked Person": [input.personId],
    "Linked Activity": [input.activity.id],
    "Linked Submissions": input.submissionIds ?? [],
    "Work Reference": input.reference,
    "Activity Details": input.notes || `Completed ${input.activity.name}`,
    "Requested Hours": requestedHours,
    "Calculated Hours": input.requestedHours != null ? requestedHours : input.activity.hoursValue,
    Hours: requestedHours,
    "Started Date": (input.startedAt || now).slice(0, 10),
    "Completed Date": input.completedAt || (input.completedDate ? `${input.completedDate}T12:00:00.000Z` : now),
    "Submitted Date": now,
    "Request Date": now.slice(0, 10),
    Status: input.approved ? "Approved" : "Submitted",
    "Ownership Agreement": input.ownershipAgreement ?? false,
    "Photo Permissions": input.photoPermissions ?? false,
  };
  if (!input.claim.isLegacySignUp) fields["Linked Claim"] = [input.claim.id];
  if (input.quantity != null) fields.Quantity = input.quantity;
  if (input.proofLink) fields["Proof Link"] = input.proofLink;
  if (input.verifiedHours != null) fields["Verified Hours"] = input.verifiedHours;
  if (input.externalReference) fields["External Reference"] = input.externalReference;
  if (input.approved) {
    fields["Review Date"] = now.slice(0, 10);
    fields["Reviewed Date"] = now;
    fields["Review Notes"] = `Approved from signed external completion ${input.externalReference || input.reference}`;
  }
  const updated = await updateRecord("Hours", reservation.id, fields);
  return mapHoursRecord({ id: updated.id, createdTime: reservation.createdTime, fields: updated.fields as HoursFields });
}
