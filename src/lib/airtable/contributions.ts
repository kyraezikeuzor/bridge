import { asStringArray, createRecord, listAllRecords, updateRecord } from "./client";
import type { Activity } from "./activities";
import type { ClaimedActivity } from "./claims";
import { mapHoursRecord, type HoursFields, type HoursRequest } from "./hours";

// ——— Contributions ———

/**
 * Contributions are completed work submitted through Bridge. They are
 * additive: legacy Submissions remain available for historic Hours records.
 */
export interface ContributionFields {
  "Linked Person"?: string[];
  "Linked Claim"?: string[];
  "Linked Activity"?: string[];
  "Work Link"?: string;
  Notes?: string;
  Status?: string;
  "Submitted At"?: string;
  /** Work-period fields owned by Contributions, not by the Hours request. */
  "Started At"?: string;
  "Completed At"?: string;
  "External Contribution ID"?: string;
  /** Hours shown on a verified external completion certificate. */
  "Certificate Hours"?: number;
  /** Hours supplied by a signed external completion sync. */
  "Verified Hours"?: number;
  /** Set after Bridge has awarded credit for this contribution. */
  "Hours Record ID"?: string;
  "Linked Hours"?: string[];
  "Linked Submissions"?: string[];
  "Contribution Quantity"?: number;
  Quantity?: number;
  "Calculated Hours"?: number;
}

export interface Contribution {
  id: string;
  createdTime: string;
  personId: string | null;
  claimId: string | null;
  activityId: string | null;
  workLink: string | null;
  notes: string | null;
  status: string;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  externalContributionId: string | null;
  certificateHours: number | null;
  verifiedHours: number | null;
  hoursRecordId: string | null;
  submissionIds: string[];
  quantity: number | null;
  calculatedHours: number | null;
}

function mapContributionRecord(record: {
  id: string;
  createdTime: string;
  fields: ContributionFields;
}): Contribution {
  return {
    id: record.id,
    createdTime: record.createdTime,
    personId: asStringArray(record.fields["Linked Person"])[0] ?? null,
    claimId: asStringArray(record.fields["Linked Claim"])[0] ?? null,
    activityId: asStringArray(record.fields["Linked Activity"])[0] ?? null,
    workLink: record.fields["Work Link"]?.trim() || null,
    notes: record.fields.Notes?.trim() || null,
    status: record.fields.Status?.trim() || "Submitted",
    submittedAt: record.fields["Submitted At"]?.trim() || record.createdTime,
    startedAt: record.fields["Started At"]?.trim() || null,
    completedAt: record.fields["Completed At"]?.trim() || null,
    externalContributionId:
      record.fields["External Contribution ID"]?.trim() || null,
    certificateHours:
      typeof record.fields["Certificate Hours"] === "number"
        ? record.fields["Certificate Hours"]
        : null,
    verifiedHours:
      typeof record.fields["Verified Hours"] === "number"
        ? record.fields["Verified Hours"]
        : null,
    hoursRecordId:
      (asStringArray(record.fields["Linked Hours"])[0] ??
      record.fields["Hours Record ID"]?.trim()) ||
      null,
    submissionIds: asStringArray(record.fields["Linked Submissions"]),
    quantity:
      typeof record.fields.Quantity === "number"
        ? record.fields.Quantity
        : typeof record.fields["Contribution Quantity"] === "number"
          ? record.fields["Contribution Quantity"]
        : null,
    calculatedHours:
      typeof record.fields["Calculated Hours"] === "number"
        ? record.fields["Calculated Hours"]
        : null,
  };
}

function isMissingContributionsTableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Airtable Contributions list failed (404)")
  );
}

export async function fetchContributionsForClaim(
  personId: string,
  claim: Pick<ClaimedActivity, "id" | "activityId" | "isLegacySignUp">
): Promise<Contribution[]> {
  try {
    const records = await listAllRecords<ContributionFields>("Contributions");
    const contributions: Contribution[] = [];
    for (const record of records) {
      const contribution = mapContributionRecord(record);
      if (contribution.personId !== personId) continue;
        if (claim.isLegacySignUp) {
          if (contribution.activityId === claim.activityId) contributions.push(contribution);
        } else if (contribution.claimId === claim.id) {
          contributions.push(contribution);
        }
    }
    return contributions.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch (error) {
    // Allow Bridge 3 to continue working until the additive setup is run.
    if (isMissingContributionsTableError(error)) return [];
    throw error;
  }
}

/** All Bridge-native work, for the leader contribution review queue. */
export async function fetchAllContributions(): Promise<Contribution[]> {
  try {
    const records = await listAllRecords<ContributionFields>("Contributions");
    return records
      .map(mapContributionRecord)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch (error) {
    if (isMissingContributionsTableError(error)) return [];
    throw error;
  }
}

export async function updateContributionStatus(
  id: string,
  status: "Approved" | "Rejected",
  options?: { hoursRecordId?: string }
): Promise<Contribution> {
  const fields: Record<string, unknown> = { Status: status };
  if (options?.hoursRecordId) fields["Linked Hours"] = [options.hoursRecordId];
  const updated = await updateRecord("Contributions", id, fields);
  return mapContributionRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as ContributionFields,
  });
}

/** Attach the Hours record created for an externally verified contribution. */
export async function linkContributionHoursRecord(
  id: string,
  hoursRecordId: string
): Promise<Contribution> {
  const updated = await updateRecord("Contributions", id, {
    "Linked Hours": [hoursRecordId],
  });
  return mapContributionRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as ContributionFields,
  });
}

/**
 * Store the final, viewer-derived units and activity credit. This is kept
 * separate from review status so a retry can safely repair an interrupted
 * finalization without creating another contribution.
 */
export async function finalizeContribution(
  id: string,
  options: { submissionIds?: string[]; quantity?: number; calculatedHours: number; hoursRecordId?: string }
): Promise<Contribution> {
  const fields: Record<string, unknown> = {
    Status: "Submitted",
    "Submitted At": new Date().toISOString(),
    "Calculated Hours": options.calculatedHours,
  };
  if (options.submissionIds?.length) fields["Linked Submissions"] = options.submissionIds;
  if (typeof options.quantity === "number") fields.Quantity = options.quantity;
  if (options.hoursRecordId) fields["Linked Hours"] = [options.hoursRecordId];
  const updated = await updateRecord("Contributions", id, fields);
  return mapContributionRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as ContributionFields,
  });
}

/** Create the submitted credit record used by the Contributions review queue. */
export async function createSubmittedHoursFromContribution(input: {
  contribution: Contribution;
  activity: Activity;
  ownershipAgreement?: boolean;
}): Promise<HoursRequest> {
  const { contribution, activity, ownershipAgreement } = input;
  if (!contribution.personId || !contribution.activityId) {
    throw new Error("Contribution is missing its linked person or activity");
  }
  const today = new Date().toISOString().slice(0, 10);
  const created = await createRecord("Hours", {
    "Linked Person": [contribution.personId],
    "Linked Activity": [contribution.activityId],
    "Activity Details": `Bridge contribution ${contribution.id}`,
    Hours: activity.hoursValue,
    "Activity Start Date": activity.startDate || today,
    "Activity End Date": activity.endDate || activity.startDate || today,
    "Request Date": today,
    Status: "Submitted",
    ...(activity.track ? { Track: activity.track } : {}),
    ...(ownershipAgreement ? { "Ownership Agreement": true } : {}),
  });
  return mapHoursRecord({
    id: created.id,
    createdTime: "",
    fields: created.fields as HoursFields,
  });
}

/**
 * Award approved work as an already-approved Hours record. This is deliberately
 * additive: it neither alters legacy requests nor routes the contribution back
 * through the old volunteer hours form.
 */
export async function createHoursFromContribution(input: {
  contribution: Contribution;
  activity: Activity;
  reviewerId?: string;
}): Promise<HoursRequest> {
  const { contribution, activity, reviewerId } = input;
  if (!contribution.personId || !contribution.activityId) {
    throw new Error("Contribution is missing its linked person or activity");
  }

  const today = new Date().toISOString().slice(0, 10);
  const details = [
    contribution.externalContributionId
      ? `External contribution ${contribution.externalContributionId}`
      : `Bridge contribution ${contribution.id}`,
    contribution.notes || "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const fields: Record<string, unknown> = {
    "Linked Person": [contribution.personId],
    "Linked Activity": [contribution.activityId],
    "Activity Details": details,
    Hours: activity.hoursValue,
    "Activity Start Date": activity.startDate || today,
    "Activity End Date": activity.endDate || activity.startDate || today,
    "Request Date": today,
    "Proof Link": contribution.workLink || undefined,
    Status: "Approved",
    "Review Date": today,
    "Review Notes": contribution.externalContributionId
      ? `Approved from signed external contribution ${contribution.externalContributionId}`
      : `Approved from Bridge contribution ${contribution.id}`,
  };
  if (activity.track) fields.Track = activity.track;
  if (reviewerId) fields.Reviewer = [reviewerId];
  // Airtable rejects undefined values in some bases.
  if (!fields["Proof Link"]) delete fields["Proof Link"];

  const created = await createRecord("Hours", fields);
  return mapHoursRecord({
    id: created.id,
    createdTime: "",
    fields: created.fields as HoursFields,
  });
}

export async function createContribution(input: {
  personId: string;
  claim: Pick<ClaimedActivity, "id" | "activityId" | "isLegacySignUp">;
  workLink?: string | null;
  notes?: string | null;
  certificateHours?: number | null;
  submissionIds?: string[];
  quantity?: number;
  calculatedHours?: number;
}): Promise<Contribution> {
  if (!input.claim.activityId) {
    throw new Error("This claim is not linked to an activity");
  }

  const fields: Record<string, unknown> = {
    "Linked Person": [input.personId],
    "Linked Activity": [input.claim.activityId],
    Status: "Submitted",
    "Submitted At": new Date().toISOString(),
  };
  // Compatibility claims do not have a physical Claims record to link.
  if (!input.claim.isLegacySignUp) fields["Linked Claim"] = [input.claim.id];
  if (input.workLink) fields["Work Link"] = input.workLink;
  if (input.notes) fields.Notes = input.notes;
  if (typeof input.certificateHours === "number") {
    fields["Certificate Hours"] = input.certificateHours;
  }
  if (input.submissionIds?.length) fields["Linked Submissions"] = input.submissionIds;
  if (typeof input.quantity === "number") fields.Quantity = input.quantity;
  if (typeof input.calculatedHours === "number") fields["Calculated Hours"] = input.calculatedHours;

  const record = await createRecord("Contributions", fields);
  return mapContributionRecord({
    id: record.id,
    createdTime: "",
    fields: record.fields as ContributionFields,
  });
}

/**
 * Store a contribution that an external platform has already verified. The
 * caller is responsible for authenticating the source and idempotency checks.
 */
export async function createExternalContribution(input: {
  personId: string;
  claim: Pick<ClaimedActivity, "id" | "activityId" | "isLegacySignUp">;
  externalContributionId: string;
  workLink?: string | null;
  notes?: string | null;
  verifiedHours?: number | null;
  submittedAt?: string | null;
}): Promise<Contribution> {
  if (!input.claim.activityId) {
    throw new Error("This claim is not linked to an activity");
  }

  const fields: Record<string, unknown> = {
    "Linked Person": [input.personId],
    "Linked Activity": [input.claim.activityId],
    "External Contribution ID": input.externalContributionId,
    Status: "Approved",
    "Submitted At": input.submittedAt || new Date().toISOString(),
  };
  if (!input.claim.isLegacySignUp) fields["Linked Claim"] = [input.claim.id];
  if (input.workLink) fields["Work Link"] = input.workLink;
  if (input.notes) fields.Notes = input.notes;
  if (typeof input.verifiedHours === "number") {
    fields["Verified Hours"] = input.verifiedHours;
  }

  const record = await createRecord("Contributions", fields);
  return mapContributionRecord({
    id: record.id,
    createdTime: "",
    fields: record.fields as ContributionFields,
  });
}

