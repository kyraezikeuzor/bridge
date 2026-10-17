import { cachedRecords, invalidateTable, asStringArray, formatTrack, getConfig, getRecord, hasStringValue, listRecordsByIds, updateRecord, type AirtableAttachment } from "./client";
import type { ReviewUpdateMeta } from "./applications";
import { fetchAllActivities, mapActivityRecord, type Activity, type ActivityFields } from "./activities";

// ——— Hours ———

export type HoursStatus = "Submitted" | "Approved" | "Rejected" | string;

export interface HoursFields {
  "Linked Person"?: string[];
  "Linked Activity"?: string[];
  "Linked Claim"?: string[];
  "Linked Submissions"?: string[];
  "Started Date"?: string;
  "Completed Date"?: string;
  "Submitted Date"?: string;
  "Reviewed Date"?: string;
  "Requested Hours"?: number;
  "Calculated Hours"?: number;
  Quantity?: number;
  "Certificate Hours"?: number;
  "Verified Hours"?: number;
  "External Reference"?: string;
  "Work Reference"?: string;
  "Legacy Contribution ID"?: string;
  Platform?: string;
  "Work Type"?: string;
  "Work Language"?: string;
  "Active Minutes"?: number;
  "Linked Assignee"?: string[];
  "Linked Reviewer"?: string[];
  /** Historic reverse link to the Bridge Contribution that awarded this credit. */
  "Linked Contributions"?: string[];
  "Activity Details"?: string;
  "Activity Submission"?: string;
  Hours?: number;
  "Activity Start Date"?: string;
  "Activity End Date"?: string;
  "Request Date"?: string;
  "Proof Link"?: string;
  Status?: string;
  Track?: string | string[];
  "Ownership Agreement"?: boolean;
  "Photo Permissions"?: boolean;
  "First Name"?: string[];
  "Last Name"?: string[];
  Assignee?: string[];
  Reviewer?: string[];
  "Review Date"?: string;
  "Review Notes"?: string;
  "Review Note"?: string;
  "Review Rating"?: string;
  "Rejection Reason"?: string;
  Proof?: AirtableAttachment[];
}

let proofFieldId: string | null | undefined;

/** Append proof to an existing draft Hours record using Airtable's attachment endpoint. */
export async function uploadHoursProof(input: { hoursId: string; file: File; filename: string }): Promise<AirtableAttachment> {
  const { apiKey, baseId } = getConfig();
  if (proofFieldId === undefined) {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to find the Hours proof field");
    const schema = await response.json() as { tables: Array<{ name: string; fields: Array<{ id: string; name: string }> }> };
    proofFieldId = schema.tables.find((table) => table.name === "Hours")?.fields.find((field) => field.name === "Proof")?.id ?? null;
  }
  if (!proofFieldId) throw new Error("Hours is missing its Proof attachment field");
  const response = await fetch(`https://content.airtable.com/v0/${baseId}/${input.hoursId}/${proofFieldId}/uploadAttachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: input.file.type, filename: input.filename, file: Buffer.from(await input.file.arrayBuffer()).toString("base64") }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Proof upload failed (${response.status})`);
  const body = await response.json() as { attachment?: AirtableAttachment };
  if (!body.attachment?.url) throw new Error("Proof upload did not return a file");
  invalidateTable("Hours");
  return body.attachment;
}

export interface LinkedActivityInfo {
  id: string;
  name: string;
  track: string | null;
  hoursValue: number;
  /** "Submission" | "Participation" | "Attendance" — Submission requires uploaded work. */
  type: string | null;
  platform?: string;
  submissionTarget?: number | null;
  submissionFormat?: string | null;
}

import {
  fetchAllSubmissions,
  mapSubmissionRecord,
  type SubmissionFields,
  type Submission,
} from "./submissions";

export interface HoursRequest {
  id: string;
  createdTime: string;
  fields: HoursFields;
  personIds: string[];
  personName: string;
  firstName: string;
  /** Display label for the Activity column (submission URL, linked name, or details). */
  activityName: string;
  /** Free-text description of what was done (Activity Details). */
  description: string | null;
  /** File/URL submitted as activity work. */
  activitySubmission: string | null;
  hoursRequested: number | null;
  /** Original request, preserved when Hours is adjusted by a reviewer. */
  requestedHours: number | null;
  calculatedHours: number | null;
  claimId: string | null;
  submissionIds: string[];
  submittedAt: string;
  workReference: string | null;
  externalReference: string | null;
  legacyContributionId: string | null;
  quantity: number | null;
  certificateHours: number | null;
  verifiedHours: number | null;
  proofFiles: AirtableAttachment[];
  reviewNotes: string | null;
  reviewedAt: string | null;
  platform: string | null;
  workType: string | null;
  startDate: string | null;
  endDate: string | null;
  date: string | null;
  dateLabel: string | null;
  proofUrl: string | null;
  status: HoursStatus;
  track: string | null;
  ownershipAgreement: boolean | null;
  photoPermissions: boolean | null;
  linkedActivityIds: string[];
  linkedActivity: LinkedActivityInfo | null;
  assigneeIds: string[];
  /** Submission records linked to this request. */
  submissions: Submission[];
  /** True when the linked activity is a Submission-type activity but nothing was submitted. */
  missingRequiredSubmission: boolean;
}

/** Format a single activity date for display / email variables. */
export function formatActivityDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function formatHoursDateLabel(
  start: string | null,
  end: string | null
): string | null {
  const fmt = (iso: string) => formatActivityDate(iso) ?? iso;
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return fmt(end);
  return null;
}

export function mapHoursRecord(
  record: {
    id: string;
    createdTime: string;
    fields: HoursFields;
  },
  linkedActivity: LinkedActivityInfo | null = null,
  submissions: Submission[] = []
): HoursRequest {
  const first = asStringArray(record.fields["First Name"])[0] ?? "";
  const last = asStringArray(record.fields["Last Name"])[0] ?? "";
  const proofAttachments = record.fields.Proof;
  const proofFromAttachment =
    Array.isArray(proofAttachments) && proofAttachments[0]?.url
      ? proofAttachments[0].url
      : null;
  const startDate = record.fields["Started Date"]?.trim() || record.fields["Activity Start Date"]?.trim() || null;
  const endDate = record.fields["Completed Date"]?.trim() || record.fields["Activity End Date"]?.trim() || null;
  const submission = record.fields["Activity Submission"]?.trim() || null;
  const details = record.fields["Activity Details"]?.trim() || null;
  const trackFromField = formatTrack(record.fields.Track) || null;
  const linkedIds = asStringArray(record.fields["Linked Activity"]);

  // "Activity Submission" is retired — name the row by its linked activity,
  // falling back to the free-text Activity Details when nothing is linked.
  const activityName = linkedActivity?.name || details || "Activity";

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    personIds: asStringArray(record.fields["Linked Person"]),
    personName: [first, last].filter(Boolean).join(" "),
    firstName: first,
    activityName,
    description: details,
    activitySubmission: submission,
    hoursRequested:
      typeof record.fields.Hours === "number" ? record.fields.Hours : null,
    requestedHours: record.fields["Requested Hours"] ?? record.fields.Hours ?? null,
    calculatedHours: record.fields["Calculated Hours"] ?? null,
    claimId: asStringArray(record.fields["Linked Claim"])[0] ?? null,
    submissionIds: asStringArray(record.fields["Linked Submissions"]),
    submittedAt: record.fields["Submitted Date"] || record.fields["Request Date"] || record.createdTime,
    workReference: record.fields["Work Reference"]?.trim() || null,
    externalReference: record.fields["External Reference"]?.trim() || null,
    legacyContributionId: record.fields["Legacy Contribution ID"]?.trim() || null,
    quantity: record.fields.Quantity ?? null,
    certificateHours: record.fields["Certificate Hours"] ?? null,
    verifiedHours: record.fields["Verified Hours"] ?? null,
    proofFiles: proofAttachments ?? [],
    reviewNotes: record.fields["Review Notes"]?.trim() || null,
    reviewedAt: record.fields["Reviewed Date"] || record.fields["Review Date"] || null,
    platform: record.fields.Platform || linkedActivity?.platform || null,
    workType: record.fields["Work Type"]?.trim() || (record.fields["Work Reference"]?.startsWith("BridgeBatch:")
      ? (asStringArray(record.fields["Linked Submissions"]).length > 0 ? "Letter Writing" : "Photo Proof")
      : null),
    startDate,
    endDate,
    date: startDate || record.fields["Request Date"]?.trim() || null,
    dateLabel: formatHoursDateLabel(
      startDate,
      endDate
    ) || (record.fields["Request Date"]
      ? formatHoursDateLabel(record.fields["Request Date"].trim(), null)
      : null),
    proofUrl: record.fields["Proof Link"]?.trim() || proofFromAttachment,
    // Airtable defaults new Hours rows to Submitted. A Bridge batch is only
    // reviewable after its evidence and submitted timestamp are finalized.
    status: record.fields["Work Reference"]?.startsWith("BridgeBatch:") && !record.fields["Submitted Date"]
      ? "Draft"
      : (record.fields.Status?.trim() as HoursStatus) || "Draft",
    track: trackFromField || linkedActivity?.track || null,
    ownershipAgreement:
      typeof record.fields["Ownership Agreement"] === "boolean"
        ? record.fields["Ownership Agreement"]
        : null,
    photoPermissions:
      typeof record.fields["Photo Permissions"] === "boolean"
        ? record.fields["Photo Permissions"]
        : null,
    linkedActivityIds: linkedIds,
    linkedActivity,
    assigneeIds: asStringArray(record.fields["Linked Assignee"] ?? record.fields.Assignee),
    submissions,
    missingRequiredSubmission:
      linkedActivity?.type === "Submission" && submissions.length === 0 && !record.fields["Proof Link"] && !proofFromAttachment,
  };
}

export async function fetchAllHours(): Promise<HoursRequest[]> {
  const [hourRecords, activities, submissions] = await Promise.all([
    cachedRecords<HoursFields>("Hours"),
    cachedRecords<ActivityFields>("Activities"),
    fetchAllSubmissions(),
  ]);

  const activityById = new Map<string, LinkedActivityInfo>();
  for (const a of activities) {
    const mapped = mapActivityRecord(a);
    activityById.set(mapped.id, {
      id: mapped.id,
      name: mapped.name,
      track: mapped.track,
      hoursValue: mapped.hoursValue,
      type: mapped.type || null,
      platform: mapped.platform,
      submissionTarget: mapped.submissionTarget,
      submissionFormat: mapped.submissionFormat,
    });
  }

  // Submissions point at Hours, so index them by the request they belong to.
  const submissionsByHoursId = new Map<string, Submission[]>();
  for (const s of submissions) {
    for (const hoursId of s.hoursRequestIds) {
      const list = submissionsByHoursId.get(hoursId);
      if (list) list.push(s);
      else submissionsByHoursId.set(hoursId, [s]);
    }
  }

  const submissionsById = new Map(submissions.map((submission) => [submission.id, submission]));

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    const linked = linkedId ? activityById.get(linkedId) ?? null : null;
    return mapHoursRecord(
      record,
      linked,
      Array.from(new Map([
        ...(submissionsByHoursId.get(record.id) ?? []),
        ...asStringArray(record.fields["Linked Submissions"]).flatMap((id) => {
          const submission = submissionsById.get(id);
          return submission ? [submission] : [];
        }),
      ].map((submission) => [submission.id, submission])).values())
    );
  });
}

function linkedActivityInfo(mapped: Activity): LinkedActivityInfo {
  return {
    id: mapped.id,
    name: mapped.name,
    track: mapped.track,
    hoursValue: mapped.hoursValue,
    type: mapped.type || null,
    platform: mapped.platform,
    submissionTarget: mapped.submissionTarget,
    submissionFormat: mapped.submissionFormat,
  };
}

/**
 * Hours rows for one person, matched on Hours."Linked Person". Reads the
 * cached Hours, Activities and Submissions tables, so a warm request makes
 * no Airtable calls. Pass `activities` when the caller already has them.
 */
export async function fetchHoursForPerson(
  personId: string,
  prefetched: { activities?: Activity[] } = {}
): Promise<HoursRequest[]> {
  const id = personId.trim();
  if (!id) return [];

  const [allHours, activityList, allSubmissions] = await Promise.all([
    cachedRecords<HoursFields>("Hours"),
    prefetched.activities ? Promise.resolve(prefetched.activities) : fetchAllActivities(),
    cachedRecords<SubmissionFields>("Submissions"),
  ]);
  const hourRecords = allHours.filter((record) => hasStringValue(record.fields["Linked Person"], id));
  const activityById = new Map(activityList.map((activity) => [activity.id, linkedActivityInfo(activity)]));
  const submissionsById = new Map(allSubmissions.map((record) => [record.id, record]));

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    return mapHoursRecord(
      record,
      linkedId ? activityById.get(linkedId) ?? null : null,
      asStringArray(record.fields["Linked Submissions"]).flatMap((submissionId) => {
        const submission = submissionsById.get(submissionId);
        return submission ? [mapSubmissionRecord(submission)] : [];
      })
    );
  });
}

export async function updateHoursStatus(
  id: string,
  status: "Approved" | "Rejected",
  meta?: ReviewUpdateMeta | string
): Promise<HoursRequest> {
  const today = new Date().toISOString().slice(0, 10);
  const fields: Record<string, unknown> = {
    Status: status,
    "Review Date": today,
    "Reviewed Date": new Date().toISOString(),
  };

  const options: ReviewUpdateMeta =
    typeof meta === "string" ? { reviewNote: meta } : meta ?? {};

  if (options.reviewerId) fields["Linked Reviewer"] = [options.reviewerId];
  // Preserve the original requested amount even for pre-migration records.
  const current = await getRecord<HoursFields>("Hours", id);
  if (!current) throw new Error("Hours request not found");
  if (current.fields.Status !== "Submitted") throw new Error("This hours request has already been reviewed or is not ready for review");
  if (current.fields["Requested Hours"] == null && typeof current.fields.Hours === "number") {
    fields["Requested Hours"] = current.fields.Hours;
  }
  if (typeof options.hours === "number") fields["Hours"] = options.hours;

  // "Review Rating" / "Rejection Reason" / "Review Note" aren't fields on the
  // Hours table — Airtable rejects the whole PATCH if they're sent. Fold the
  // chosen label and note into "Review Notes", which does exist.
  const label = options.reviewRating || options.rejectionReason;
  const reviewNotes = [label, options.reviewNote].filter(Boolean).join("\n\n");
  if (reviewNotes) fields["Review Notes"] = reviewNotes;

  const updated = await updateRecord("Hours", id, fields);
  return mapHoursRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as HoursFields,
  });
}

/** Uncached record and exact evidence snapshot, for authoritative review checks. */
export async function fetchHoursRequestById(id: string): Promise<HoursRequest | null> {
  const record = await getRecord<HoursFields>("Hours", id);
  if (!record) return null;
  const activityId = asStringArray(record.fields["Linked Activity"])[0];
  const [activityRecord, submissionRecords] = await Promise.all([
    activityId ? getRecord<ActivityFields>("Activities", activityId) : Promise.resolve(null),
    listRecordsByIds<SubmissionFields>("Submissions", asStringArray(record.fields["Linked Submissions"])),
  ]);
  const activity = activityRecord ? mapActivityRecord(activityRecord) : null;
  return mapHoursRecord(record, activity ? {
    id: activity.id, name: activity.name, track: activity.track, hoursValue: activity.hoursValue,
    type: activity.type, platform: activity.platform, submissionTarget: activity.submissionTarget,
    submissionFormat: activity.submissionFormat,
  } : null, submissionRecords.map(mapSubmissionRecord));
}

export interface PersonHoursSummary {
  approvedThisMonth: number;
  pendingReview: number;
  lifetimeTotal: number;
  records: HoursRequest[];
}

export function summarizePersonHours(records: HoursRequest[]): PersonHoursSummary {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let approvedThisMonth = 0;
  let pendingReview = 0;
  let lifetimeTotal = 0;

  for (const row of records) {
    const hours = row.hoursRequested ?? 0;
    if (row.status === "Submitted") {
      pendingReview += 1;
    }
    if (row.status === "Approved") {
      lifetimeTotal += hours;
      if (row.date) {
        const d = new Date(row.date);
        if (
          !Number.isNaN(d.getTime()) &&
          d.getMonth() === month &&
          d.getFullYear() === year
        ) {
          approvedThisMonth += hours;
        }
      }
    }
  }

  return { approvedThisMonth, pendingReview, lifetimeTotal, records };
}
