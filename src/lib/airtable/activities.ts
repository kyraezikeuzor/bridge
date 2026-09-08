import { asStringArray, hasStringValue, listAllRecords, recordIdOrFormula, updateRecord } from "./client";
import { getPersonById } from "./people";

// ——— Activities ———

export interface ActivityFields {
  "Activity Name"?: string;
  Track?: string;
  Type?: string;
  Description?: string;
  Instructions?: string;
  "Hours Value"?: number;
  "Submission Target"?: number;
  /** Whether Bridge should collect written text or a PDF for each submission. */
  "Submission Format"?: string;
  "Slots Total"?: number;
  "Slots Filled"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  Languages?: string[];
  Status?: string;
  "Fillout Link"?: string;
  "Linked Sign Ups"?: string[];
  "Linked Hours Requests"?: string[];
  /** Reverse link from the additive Claims table. */
  "Linked Claims"?: string[];
  /** The system that owns the completed work. */
  Platform?: string;
  /** Stable identifier used by an external platform integration. */
  "External Project ID"?: string;
  /** Human-openable link to the configured external project. */
  "External Project URL"?: string;
}

export type ActivityPlatform = "Bridge" | "Oppia" | "Monsoon" | "Other";
export type SubmissionFormat = "Text" | "File";

export interface Activity {
  id: string;
  createdTime: string;
  fields: ActivityFields;
  name: string;
  track: string | null;
  type: string | null;
  description: string | null;
  hoursValue: number;
  submissionTarget: number | null;
  submissionFormat: SubmissionFormat | null;
  slotsTotal: number;
  slotsFilled: number;
  languages: string[];
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  filloutLink: string | null;
  signUpIds: string[];
  platform: ActivityPlatform;
  externalProjectId: string | null;
  externalProjectUrl: string | null;
}

export function mapActivityRecord(record: {
  id: string;
  createdTime: string;
  fields: ActivityFields;
}): Activity {
  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    name: record.fields["Activity Name"]?.trim() || "Untitled Activity",
    track: record.fields.Track?.trim() || null,
    type: record.fields.Type?.trim() || null,
    description: record.fields.Description?.trim() || null,
    hoursValue:
      typeof record.fields["Hours Value"] === "number"
        ? record.fields["Hours Value"]
        : 0,
    submissionTarget:
      typeof record.fields["Submission Target"] === "number" && record.fields["Submission Target"] > 0
        ? record.fields["Submission Target"]
        : null,
    submissionFormat: normalizeSubmissionFormat(record.fields["Submission Format"]),
    slotsTotal:
      typeof record.fields["Slots Total"] === "number"
        ? record.fields["Slots Total"]
        : 0,
    slotsFilled:
      typeof record.fields["Slots Filled"] === "number"
        ? record.fields["Slots Filled"]
        : 0,
    languages: asStringArray(record.fields.Languages),
    status: record.fields.Status?.trim() || null,
    startDate: record.fields["Start Date"]?.trim() || null,
    endDate: record.fields["End Date"]?.trim() || null,
    filloutLink: record.fields["Fillout Link"]?.trim() || null,
    signUpIds: asStringArray(record.fields["Linked Sign Ups"]),
    platform: normalizePlatform(record.fields.Platform),
    externalProjectId: record.fields["External Project ID"]?.trim() || null,
    externalProjectUrl: record.fields["External Project URL"]?.trim() || null,
  };
}

function normalizeSubmissionFormat(value: string | undefined): SubmissionFormat | null {
  switch (value?.trim().toLowerCase()) {
    case "text":
      return "Text";
    case "file":
    case "pdf":
      return "File";
    default:
      return null;
  }
}

function normalizePlatform(value: string | undefined): ActivityPlatform {
  switch (value?.trim()) {
    case "Oppia":
    case "Monsoon":
    case "Other":
    case "Bridge":
      return value.trim() as ActivityPlatform;
    default:
      return "Bridge";
  }
}


export async function fetchAllActivities(): Promise<Activity[]> {
  const records = await listAllRecords<ActivityFields>("Activities");
  return records.map(mapActivityRecord);
}

export async function updateActivityStatus(
  id: string,
  status: "Submitted" | "Active" | "Closed"
): Promise<Activity> {
  const updated = await updateRecord("Activities", id, { Status: status });
  return mapActivityRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as ActivityFields,
  });
}

/**
 * Activities a person signed up for.
 *
 * Linked Sign Ups is a linked-record field (People Airtable IDs), not email.
 * Use People."Linked Activity Sign Ups" when present, otherwise filter
 * Activities where Linked Sign Ups includes personId.
 */
export async function fetchActivitiesForPerson(
  personId: string
): Promise<Activity[]> {
  const id = personId.trim();
  console.log("[airtable] fetchActivitiesForPerson personId:", id);
  if (!id) return [];

  const person = await getPersonById(id);
  const reverseIds = asStringArray(person?.fields["Linked Activity Sign Ups"]);
  console.log(
    "[airtable] People.Linked Activity Sign Ups (linked record IDs):",
    reverseIds
  );

  let activityRecords: Array<{
    id: string;
    createdTime: string;
    fields: ActivityFields;
  }> = [];

  if (reverseIds.length > 0) {
    const idFormula = recordIdOrFormula(reverseIds);
    activityRecords = await listAllRecords<ActivityFields>("Activities", {
      filterByFormula: idFormula,
    });
  }

  // Reverse link is often empty — match Linked Sign Ups (People record IDs) in memory
  if (activityRecords.length === 0) {
    console.log(
      "[airtable] Scanning Activities.Linked Sign Ups for personId",
      id
    );
    const all = await listAllRecords<ActivityFields>("Activities");
    activityRecords = all.filter((record) =>
      hasStringValue(record.fields["Linked Sign Ups"], id)
    );
  } else {
    activityRecords = activityRecords.filter((record) =>
      hasStringValue(record.fields["Linked Sign Ups"], id)
    );
  }

  console.log(
    "[airtable] fetchActivitiesForPerson matched Activities count:",
    activityRecords.length
  );

  return activityRecords.map(mapActivityRecord);
}
