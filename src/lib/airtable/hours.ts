import { asStringArray, formatTrack, hasStringValue, listAllRecords, recordIdOrFormula, updateRecord, type AirtableAttachment } from "./client";
import { getPersonById } from "./people";
import type { ReviewUpdateMeta } from "./applications";
import { mapActivityRecord, type ActivityFields } from "./activities";
import { fetchAllContributions, type Contribution } from "./contributions";

// ——— Hours ———

export type HoursStatus = "Submitted" | "Approved" | "Rejected" | string;

export interface HoursFields {
  "Linked Person"?: string[];
  "Linked Activity"?: string[];
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

export interface LinkedActivityInfo {
  id: string;
  name: string;
  track: string | null;
  hoursValue: number;
  /** "Submission" | "Participation" | "Attendance" — Submission requires uploaded work. */
  type: string | null;
}

import {
  fetchAllSubmissions,
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

/** Resolve either side of the Hours ↔ Contributions relationship. */
function findContributionForHours(
  record: { id: string; fields: HoursFields },
  contributionById: Map<string, Contribution>,
  contributionByHoursId: Map<string, Contribution>
): Contribution | null {
  const linkedContributionId = asStringArray(record.fields["Linked Contributions"])[0];
  return (linkedContributionId ? contributionById.get(linkedContributionId) : undefined)
    ?? contributionByHoursId.get(record.id)
    ?? null;
}

function indexContributions(contributions: Contribution[]) {
  const byId = new Map<string, Contribution>();
  const byHoursId = new Map<string, Contribution>();
  for (const contribution of contributions) {
    byId.set(contribution.id, contribution);
    if (contribution.hoursRecordId) {
      byHoursId.set(contribution.hoursRecordId, contribution);
    }
  }
  return { byId, byHoursId };
}

export function mapHoursRecord(
  record: {
    id: string;
    createdTime: string;
    fields: HoursFields;
  },
  linkedActivity: LinkedActivityInfo | null = null,
  submissions: Submission[] = [],
  contribution: Contribution | null = null
): HoursRequest {
  const first = asStringArray(record.fields["First Name"])[0] ?? "";
  const last = asStringArray(record.fields["Last Name"])[0] ?? "";
  const proofAttachments = record.fields.Proof;
  const proofFromAttachment =
    Array.isArray(proofAttachments) && proofAttachments[0]?.url
      ? proofAttachments[0].url
      : null;
  // Contributions own the dates volunteers actually worked. Keep the Hours
  // fields only as a compatibility fallback for historical, unlinked credit.
  const startDate = contribution?.startedAt || record.fields["Activity Start Date"]?.trim() || null;
  const endDate = contribution?.completedAt || record.fields["Activity End Date"]?.trim() || null;
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
    status: (record.fields.Status?.trim() as HoursStatus) || "Submitted",
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
    assigneeIds: asStringArray(record.fields.Assignee),
    submissions,
    missingRequiredSubmission:
      linkedActivity?.type === "Submission" && submissions.length === 0,
  };
}

export async function fetchAllHours(): Promise<HoursRequest[]> {
  const [hourRecords, activities, submissions, contributions] = await Promise.all([
    listAllRecords<HoursFields>("Hours"),
    listAllRecords<ActivityFields>("Activities"),
    fetchAllSubmissions(),
    fetchAllContributions(),
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

  const { byId: contributionById, byHoursId: contributionByHoursId } =
    indexContributions(contributions);

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    const linked = linkedId ? activityById.get(linkedId) ?? null : null;
    return mapHoursRecord(
      record,
      linked,
      submissionsByHoursId.get(record.id) ?? [],
      findContributionForHours(record, contributionById, contributionByHoursId)
    );
  });
}

/**
 * Hours for one People record.
 *
 * Linked Person is a linked-record field (Airtable IDs), not email.
 * We resolve via People."Linked Hours" + RECORD_ID(), falling back to an
 * in-memory filter if the reverse link is unavailable.
 */
export async function fetchHoursForPerson(
  personId: string
): Promise<HoursRequest[]> {
  const id = personId.trim();
  console.log("[airtable] fetchHoursForPerson personId:", id);
  if (!id) return [];

  const person = await getPersonById(id);
  const linkedHourIds = asStringArray(person?.fields["Linked Hours"]);
  console.log(
    "[airtable] People.Linked Hours (linked record IDs):",
    linkedHourIds
  );

  let hourRecords: Array<{
    id: string;
    createdTime: string;
    fields: HoursFields;
  }> = [];

  if (linkedHourIds.length > 0) {
    const idFormula = recordIdOrFormula(linkedHourIds);
    hourRecords = await listAllRecords<HoursFields>("Hours", {
      filterByFormula: idFormula,
    });
  } else {
    console.log(
      "[airtable] No People.Linked Hours — scanning Hours.Linked Person for",
      id
    );
    const all = await listAllRecords<HoursFields>("Hours");
    hourRecords = all.filter((record) =>
      hasStringValue(record.fields["Linked Person"], id)
    );
  }

  // Always keep rows whose Linked Person includes this Airtable ID
  hourRecords = hourRecords.filter((record) =>
    hasStringValue(record.fields["Linked Person"], id)
  );

  console.log(
    "[airtable] fetchHoursForPerson matched Hours count:",
    hourRecords.length
  );

  // Join the linked activities so rows are named by their activity rather than
  // falling through to Activity Details / "Activity".
  const linkedActivityIds = Array.from(
    new Set(
      hourRecords.flatMap((record) =>
        asStringArray(record.fields["Linked Activity"])
      )
    )
  );

  const activityById = new Map<string, LinkedActivityInfo>();
  const [activityRecords, contributions] = await Promise.all([
    linkedActivityIds.length > 0
      ? listAllRecords<ActivityFields>("Activities", {
          filterByFormula: recordIdOrFormula(linkedActivityIds),
        })
      : Promise.resolve([]),
    fetchAllContributions(),
  ]);
  if (activityRecords.length > 0) {
    for (const a of activityRecords) {
      const mapped = mapActivityRecord(a);
      activityById.set(mapped.id, {
        id: mapped.id,
        name: mapped.name,
        track: mapped.track,
        hoursValue: mapped.hoursValue,
        type: mapped.type || null,
      });
    }
  }

  const { byId: contributionById, byHoursId: contributionByHoursId } =
    indexContributions(contributions);

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    return mapHoursRecord(
      record,
      linkedId ? activityById.get(linkedId) ?? null : null,
      [],
      findContributionForHours(record, contributionById, contributionByHoursId)
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
  };

  const options: ReviewUpdateMeta =
    typeof meta === "string" ? { reviewNote: meta } : meta ?? {};

  if (options.reviewerId) fields["Reviewer"] = [options.reviewerId];
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
