import { cachedRecords, escapeFormulaString, getRecord, asStringArray, createRecord, formatTrack, listAllRecords, updateRecord } from "./client";
import { mapPersonRecord, type Person, type PersonFields } from "./people";

// ——— Applications ———

export type ApplicationStatus = "Submitted" | "Accepted" | "Rejected" | string;

export interface ApplicationFields {
  "First Name"?: string;
  "Last Name"?: string;
  Email?: string;
  Track?: string[];
  Status?: string;
  Role?: string;
  Birthday?: string;
  "Applicant Age"?: number;
  School?: string;
  State?: string;
  Country?: string;
  Languages?: string[];
  Discovery?: string;
  "Interest Statement"?: string;
  Comments?: string;
  "Application Date"?: string;
  "Review Date"?: string;
  "Review Notes"?: string;
  "Review Note"?: string;
  "Review Rating"?: string;
  "Rejection Reason"?: string;
  "Onboarding Details"?: string;
  "Linked Person"?: string[];
  Assignee?: string[];
  Reviewer?: string[];
}

export interface Application {
  id: string;
  createdTime: string;
  fields: ApplicationFields;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  track: string;
  tracks: string[];
  status: ApplicationStatus;
  role: string;
  birthday: string | null;
  age: number | null;
  school: string | null;
  state: string | null;
  country: string | null;
  languages: string[];
  discovery: string | null;
  interestStatement: string | null;
  comments: string | null;
  assigneeIds: string[];
}

export function mapApplicationRecord(record: {
  id: string;
  createdTime: string;
  fields: ApplicationFields;
}): Application {
  const firstName = record.fields["First Name"]?.trim() ?? "";
  const lastName = record.fields["Last Name"]?.trim() ?? "";
  const tracks = asStringArray(record.fields.Track);
  const commentsRaw = record.fields.Comments?.trim() ?? "";
  const comments =
    !commentsRaw || /^none$/i.test(commentsRaw) ? null : commentsRaw;

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" "),
    email: record.fields.Email?.trim() ?? "",
    track: formatTrack(tracks),
    tracks,
    status: (record.fields.Status?.trim() as ApplicationStatus) || "Submitted",
    role: record.fields.Role?.trim() || "Volunteer",
    birthday: record.fields.Birthday?.trim() || null,
    age:
      typeof record.fields["Applicant Age"] === "number"
        ? record.fields["Applicant Age"]
        : null,
    school: record.fields.School?.trim() || null,
    state: record.fields.State?.trim() || null,
    country: record.fields.Country?.trim() || null,
    languages: asStringArray(record.fields.Languages),
    discovery: record.fields.Discovery?.trim() || null,
    interestStatement: record.fields["Interest Statement"]?.trim() || null,
    comments,
    assigneeIds: asStringArray(record.fields.Assignee),
  };
}

export async function fetchAllApplications(): Promise<Application[]> {
  const records = await listAllRecords<ApplicationFields>("Applications");
  return records.map(mapApplicationRecord);
}

/** A blank Status counts as Submitted, matching mapApplicationRecord. */
const INBOX_FORMULA = "OR({Status}='Submitted', {Status}='')";

/** Applications still waiting for a decision, from the shared cache. */
export async function fetchInboxApplications(): Promise<Application[]> {
  const records = await cachedRecords<ApplicationFields>("Applications", INBOX_FORMULA);
  return records.map(mapApplicationRecord);
}

/** Decided applications with one status, loaded only when a director asks. */
export async function fetchApplicationsByStatus(status: string): Promise<Application[]> {
  const records = await listAllRecords<ApplicationFields>("Applications", {
    filterByFormula: `{Status}='${escapeFormulaString(status)}'`,
  });
  return records.map(mapApplicationRecord);
}

export async function fetchApplicationById(id: string): Promise<Application | null> {
  if (!/^rec[a-zA-Z0-9]+$/.test(id)) return null;
  const record = await getRecord<ApplicationFields>("Applications", id);
  return record ? mapApplicationRecord(record) : null;
}

export type ReviewUpdateMeta = {
  /** Approve rating (Great / Good / Adequate / Needs Follow-up). */
  reviewRating?: string;
  /** Reject reason pill label. */
  rejectionReason?: string;
  /** Optional free-text note. */
  reviewNote?: string;
  /** People record id of the signed-in reviewer, linked into "Reviewer". */
  reviewerId?: string;
  /**
   * Hours to award, when the reviewer overrides what the volunteer requested
   * (e.g. crediting one hour per submitted item). Hours requests only.
   */
  hours?: number;
};

export async function updateApplicationStatus(
  id: string,
  status: "Accepted" | "Rejected",
  meta?: ReviewUpdateMeta | string
): Promise<Application> {
  const today = new Date().toISOString().slice(0, 10);
  const fields: Record<string, unknown> = {
    Status: status,
    "Review Date": today,
  };

  // Back-compat: third arg used to be a plain reviewNotes string
  const options: ReviewUpdateMeta =
    typeof meta === "string" ? { reviewNote: meta } : meta ?? {};

  if (options.reviewerId) fields["Reviewer"] = [options.reviewerId];

  // "Review Rating" / "Rejection Reason" aren't real Airtable fields on this
  // table — fold the chosen label and note into "Review Notes" instead.
  const label = options.reviewRating || options.rejectionReason;
  const reviewNotes = [label, options.reviewNote].filter(Boolean).join(" — ");
  if (reviewNotes) fields["Review Notes"] = reviewNotes;

  const updated = await updateRecord("Applications", id, fields);
  return mapApplicationRecord({
    id: updated.id,
    createdTime: "",
    fields: updated.fields as ApplicationFields,
  });
}

export async function createPersonFromApplication(
  app: Application
): Promise<Person> {
  // NOTE: do not write "Status". It is a computed field on People, derived from
  // the person's stints, and Airtable rejects the whole create with a 422
  // (INVALID_VALUE_FOR_COLUMN) if it is included — which silently orphaned every
  // approved volunteer until 2026-08-22.
  const fields: Record<string, unknown> = {
    Email: app.email,
    "First Name": app.firstName,
    "Last Name": app.lastName,
  };
  if (app.birthday) fields.Birthday = app.birthday;
  if (app.state) fields.State = app.state;
  if (app.country) fields.Country = app.country;
  if (app.languages.length) fields.Languages = app.languages;

  try {
    return await createPersonRecord(fields);
  } catch (err) {
    // State/Country/Languages are single-selects. An applicant whose value is
    // not already an option (e.g. a country we have never seen) makes Airtable
    // reject the entire create, and the token cannot add options. Losing the
    // whole person over an optional field is worse than losing the field, so
    // retry with just the identity, and say loudly what was dropped.
    if (!isUnknownSelectOptionError(err)) throw err;

    const dropped = ["State", "Country", "Languages"].filter((f) => f in fields);
    console.warn(
      `[airtable] People create for ${app.email} rejected an unknown select option — retrying without ${dropped.join(", ")}:`,
      err instanceof Error ? err.message : err
    );
    for (const f of dropped) delete fields[f];
    return createPersonRecord(fields);
  }
}

function isUnknownSelectOptionError(err: unknown): boolean {
  return (
    err instanceof Error && err.message.includes("INVALID_MULTIPLE_CHOICE_OPTIONS")
  );
}

async function createPersonRecord(
  fields: Record<string, unknown>
): Promise<Person> {
  const created = await createRecord("People", fields);
  return mapPersonRecord({
    id: created.id,
    createdTime: "",
    fields: created.fields as PersonFields,
  });
}

/** Coerce Airtable's assorted date shapes to YYYY-MM-DD. */
function toIsoDate(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toISOString().slice(0, 10);
}

/**
 * Create the stint that puts someone on the roster.
 *
 * A person's "Status" is a formula over their stints: an open stint (Start Date
 * set, End Date empty) is what makes them read as Active. So this record — not
 * any field on People — is what activates them. Start Date is the application's
 * review date, i.e. when they were actually accepted, which is only "today" for
 * a live approval; a backfill must pass the real review date instead.
 */
export async function createPeopleHistoryForApplication(options: {
  personId?: string;
  applicationId: string;
  role: string;
  tracks: string[];
  school?: string | null;
  state?: string | null;
  country?: string | null;
  /** The application's Review Date. Falls back to today when it has none. */
  startDate?: string | null;
}): Promise<string> {
  const start =
    toIsoDate(options.startDate) ?? new Date().toISOString().slice(0, 10);
  const fields: Record<string, unknown> = {
    "Linked Application": [options.applicationId],
    // End Date is deliberately left unset — an open stint is what makes the
    // person's computed Status read "Active".
    "Start Date": start,
    Role: options.role,
  };
  if (options.personId) fields["Linked Person"] = [options.personId];
  if (options.tracks.length) fields.Track = options.tracks;
  if (options.school) fields.School = options.school;
  if (options.state) fields.State = options.state;
  if (options.country) fields.Country = options.country;

  try {
    const created = await createRecord("People History", fields);
    return created.id;
  } catch (err) {
    // Same single-select trap as People: an unknown Track/School/State/Country
    // would otherwise cost the whole stint record.
    if (!isUnknownSelectOptionError(err)) throw err;

    const dropped = ["Track", "School", "State", "Country"].filter(
      (f) => f in fields
    );
    console.warn(
      `[airtable] People History create rejected an unknown select option — retrying without ${dropped.join(", ")}:`,
      err instanceof Error ? err.message : err
    );
    for (const f of dropped) delete fields[f];
    const created = await createRecord("People History", fields);
    return created.id;
  }
}

/** People History rows as stored — only the fields callers here care about. */
export interface PeopleHistoryRecord {
  id: string;
  applicationIds: string[];
  personIds: string[];
  role: string | null;
}

/**
 * Every People History row, flattened to its link fields. Used to reconcile
 * history against People when an approval half-completed.
 */
export async function fetchAllPeopleHistory(): Promise<PeopleHistoryRecord[]> {
  const records = await listAllRecords<{
    "Linked Application"?: string[];
    "Linked Person"?: string[];
    Role?: string;
  }>("People History");

  return records.map((r) => ({
    id: r.id,
    applicationIds: asStringArray(r.fields["Linked Application"]),
    personIds: asStringArray(r.fields["Linked Person"]),
    role: r.fields.Role?.trim() || null,
  }));
}

/** Attach a People History row to the person it belongs to. */
export async function linkPersonToHistory(
  historyId: string,
  personId: string
): Promise<void> {
  await updateRecord("People History", historyId, {
    "Linked Person": [personId],
  });
}

/** Append-only diagnostics field on Applications — for dev-team eyes only, never rendered in the app UI. */
export async function updateApplicationOnboardingDetails(
  id: string,
  text: string
): Promise<void> {
  await updateRecord("Applications", id, { "Onboarding Details": text });
}

