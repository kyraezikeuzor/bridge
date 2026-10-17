import { asStringArray, cachedRecords, createRecord, updateRecord } from "./client";

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
  "Completion Workflow"?: string;
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
  Category?: string;
  "Project Category"?: string;
  "Project Guide URL"?: string;
  "Creates Project"?: boolean;
  "Project Capacity"?: number;
  "Project Minimum Quantity"?: number;
  "Linked Service Center"?: string[];
  "Created By"?: string[];
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
  completionWorkflow: "Letters" | "Photo proof";
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
  category: string | null;
  createsProject: boolean;
  projectCapacity: number;
  projectMinimumQuantity: number | null;
  centerId: string | null;
  guideUrl: string | null;
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
    completionWorkflow: record.fields["Completion Workflow"] === "Letters" ||
      (record.fields["Completion Workflow"] !== "Photo proof" &&
        (record.fields.Category === "Letters" || record.fields["Project Category"] === "Letters" || /\bletter(?:s| writing)?\b/i.test(record.fields["Activity Name"] || "")))
      ? "Letters" : "Photo proof",
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
    category: record.fields["Project Category"]?.trim() || record.fields.Category?.trim() || null,
    createsProject: record.fields["Creates Project"] === true,
    projectCapacity: typeof record.fields["Project Capacity"] === "number" ? record.fields["Project Capacity"] : 5,
    projectMinimumQuantity: typeof record.fields["Project Minimum Quantity"] === "number" ? record.fields["Project Minimum Quantity"] : null,
    centerId: asStringArray(record.fields["Linked Service Center"])[0] ?? null,
    guideUrl: record.fields["Project Guide URL"]?.trim() || null,
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
  const records = await cachedRecords<ActivityFields>("Activities");
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

export async function createProjectActivity(fields: ActivityFields): Promise<Activity> {
  const record = await createRecord("Activities", fields as Record<string, unknown>);
  return mapActivityRecord({ id: record.id, createdTime: new Date().toISOString(), fields: record.fields as ActivityFields });
}

