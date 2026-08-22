/**
 * Airtable client helpers for Bridge.
 * Field names match the live base exactly — do not rename.
 */

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

function getConfig() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error(
      "Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables"
    );
  }
  return { apiKey, baseId };
}

export type AirtableAttachment = {
  id?: string;
  url: string;
  filename: string;
};

type AirtableListResponse<TFields> = {
  records: Array<{
    id: string;
    createdTime: string;
    fields: TFields;
  }>;
  offset?: string;
};

function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** OR(RECORD_ID()='…', …) — used when resolving linked-record reverse links. */
function recordIdOrFormula(ids: string[]): string {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return "FALSE()";
  return `OR(${unique
    .map((id) => `RECORD_ID()='${escapeFormulaString(id)}'`)
    .join(",")})`;
}

async function listAllRecords<TFields>(
  table: string,
  options?: { filterByFormula?: string; debugLabel?: string }
): Promise<Array<{ id: string; createdTime: string; fields: TFields }>> {
  const { apiKey, baseId } = getConfig();
  const records: Array<{ id: string; createdTime: string; fields: TFields }> =
    [];
  let offset: string | undefined;
  let page = 0;

  if (options?.debugLabel && options.filterByFormula) {
    console.log(
      `[airtable] ${options.debugLabel} filterByFormula:`,
      options.filterByFormula
    );
  }

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    if (options?.filterByFormula) {
      params.set("filterByFormula", options.filterByFormula);
    }

    const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${table} list failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as AirtableListResponse<TFields>;
    page += 1;
    if (options?.debugLabel && page === 1) {
      console.log(
        `[airtable] ${options.debugLabel} raw response (page 1, before parse):`,
        JSON.stringify(data)
      );
    }
    for (const record of data.records ?? []) {
      records.push(record);
    }
    offset = data.offset;
  } while (offset);

  return records;
}

async function createRecord(
  table: string,
  fields: Record<string, unknown>
): Promise<{ id: string; fields: Record<string, unknown> }> {
  const { apiKey, baseId } = getConfig();
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${table} create failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { id: string; fields: Record<string, unknown> };
}

async function updateRecord(
  table: string,
  id: string,
  fields: Record<string, unknown>
): Promise<{ id: string; fields: Record<string, unknown> }> {
  const { apiKey, baseId } = getConfig();
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${table} update failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { id: string; fields: Record<string, unknown> };
}

function formatTrack(track?: string | string[]): string {
  if (!track) return "";
  return Array.isArray(track) ? track.filter(Boolean).join(", ") : track;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && !!v.trim());
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

// ——— People ———

export interface PersonFields {
  Email?: string;
  "First Name"?: string;
  "Last Name"?: string;
  Discord?: string;
  Birthday?: string;
  Gender?: string;
  State?: string;
  Country?: string;
  Status?: string;
  Phone?: string;
  Joined?: string;
  Languages?: string[];
  Notes?: string;
  "Latest Role"?: string[];
  "All Roles"?: string[];
  "Latest Position"?: (string | null)[];
  "Total Stints"?: number;
  "Closed Stints"?: number;
  "Linked History"?: string[];
  "Linked Applications"?: string[];
  "Linked Assigned Hours"?: string[];
  "Linked Assigned Applications"?: string[];
  "Linked Reviewed Hours"?: string[];
  "Linked Reviewed Applications"?: string[];
  "Linked Application (from Linked History)"?: string[];
  "Linked Hours"?: string[];
  "Linked Activity Sign Ups"?: string[];
}

export interface Person {
  id: string;
  createdTime: string;
  fields: PersonFields;
  role: string | null;
  firstName: string | null;
}

export function mapPersonRecord(record: {
  id: string;
  createdTime: string;
  fields: PersonFields;
}): Person {
  const latestRole = record.fields["Latest Role"];
  const role =
    Array.isArray(latestRole) && latestRole.length > 0
      ? (latestRole.find((r) => typeof r === "string" && r.trim()) ?? null)
      : null;
  const firstNameRaw = record.fields["First Name"]?.trim();

  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    role: role ?? null,
    firstName: firstNameRaw || null,
  };
}

export function getPersonTemplateName(person: Person): string {
  return person.firstName?.trim() || person.fields["First Name"]?.trim() || "";
}

export async function fetchAllPeople(): Promise<Person[]> {
  const records = await listAllRecords<PersonFields>("People");
  return records.map(mapPersonRecord);
}

export async function getPersonByEmailDirect(
  email: string
): Promise<Person | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const formula = `LOWER({Email})=LOWER('${escapeFormulaString(trimmed)}')`;
  const records = await listAllRecords<PersonFields>("People", {
    filterByFormula: formula,
  });
  // listAllRecords paginates everything matching; for email we only need one
  const record = records[0];
  if (!record) return null;
  return mapPersonRecord(record);
}

export async function getPersonById(id: string): Promise<Person | null> {
  const { apiKey, baseId } = getConfig();
  const url = `${AIRTABLE_API_URL}/${baseId}/People/${id}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable People get failed (${res.status}): ${body}`);
  }
  const record = (await res.json()) as {
    id: string;
    createdTime: string;
    fields: PersonFields;
  };
  return mapPersonRecord(record);
}

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

// ——— Hours ———

export type HoursStatus = "Submitted" | "Approved" | "Rejected" | string;

export interface HoursFields {
  "Linked Person"?: string[];
  "Linked Activity"?: string[];
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

export interface SubmissionFields {
  "Activity Name(s)"?: string[];
  Attachment?: AirtableAttachment[];
  Content?: string;
  "Linked Activity"?: string[];
  "Linked Hours Requests"?: string[];
  "Linked Person"?: string[];
  Status?: string;
  "Submission Category"?: string | string[];
  "Submission ID"?: number;
  "Submitted Date"?: string;
}

export interface SubmissionFile {
  url: string;
  filename: string;
}

export interface Submission {
  id: string;
  activityName: string | null;
  category: string | null;
  status: string;
  submittedDate: string | null;
  /** Free-text or a pasted link, when no file was attached. */
  content: string | null;
  files: SubmissionFile[];
  hoursRequestIds: string[];
}

function mapSubmissionRecord(record: {
  id: string;
  fields: SubmissionFields;
}): Submission {
  const attachments = Array.isArray(record.fields.Attachment)
    ? record.fields.Attachment
    : [];

  return {
    id: record.id,
    activityName: asStringArray(record.fields["Activity Name(s)"])[0] ?? null,
    category: formatTrack(record.fields["Submission Category"]) || null,
    status: record.fields.Status?.trim() || "Submitted",
    submittedDate: record.fields["Submitted Date"]?.trim() || null,
    content: record.fields.Content?.trim() || null,
    files: attachments
      .filter((a) => a?.url)
      .map((a) => ({ url: a.url, filename: a.filename || "Attachment" })),
    hoursRequestIds: asStringArray(record.fields["Linked Hours Requests"]),
  };
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  const records = await listAllRecords<SubmissionFields>("Submissions");
  return records.map(mapSubmissionRecord);
}

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
  const startDate = record.fields["Activity Start Date"]?.trim() || null;
  const endDate = record.fields["Activity End Date"]?.trim() || null;
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
  const [hourRecords, activities, submissions] = await Promise.all([
    listAllRecords<HoursFields>("Hours"),
    listAllRecords<ActivityFields>("Activities"),
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

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    const linked = linkedId ? activityById.get(linkedId) ?? null : null;
    return mapHoursRecord(
      record,
      linked,
      submissionsByHoursId.get(record.id) ?? []
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
      asStringArray(record.fields["Linked Person"]).includes(id)
    );
  }

  // Always keep rows whose Linked Person includes this Airtable ID
  hourRecords = hourRecords.filter((record) =>
    asStringArray(record.fields["Linked Person"]).includes(id)
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
  if (linkedActivityIds.length > 0) {
    const activityRecords = await listAllRecords<ActivityFields>("Activities", {
      filterByFormula: recordIdOrFormula(linkedActivityIds),
    });
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

  return hourRecords.map((record) => {
    const linkedId = asStringArray(record.fields["Linked Activity"])[0];
    return mapHoursRecord(
      record,
      linkedId ? activityById.get(linkedId) ?? null : null
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

// ——— Activities ———

export interface ActivityFields {
  "Activity Name"?: string;
  Track?: string;
  Type?: string;
  Description?: string;
  Instructions?: string;
  "Hours Value"?: number;
  "Slots Total"?: number;
  "Slots Filled"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  Languages?: string[];
  Status?: string;
  "Fillout Link"?: string;
  "Linked Sign Ups"?: string[];
  "Linked Hours Requests"?: string[];
}

export interface Activity {
  id: string;
  createdTime: string;
  fields: ActivityFields;
  name: string;
  track: string | null;
  type: string | null;
  description: string | null;
  hoursValue: number;
  slotsTotal: number;
  slotsFilled: number;
  languages: string[];
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  filloutLink: string | null;
  signUpIds: string[];
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
  };
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
      asStringArray(record.fields["Linked Sign Ups"]).includes(id)
    );
  } else {
    activityRecords = activityRecords.filter((record) =>
      asStringArray(record.fields["Linked Sign Ups"]).includes(id)
    );
  }

  console.log(
    "[airtable] fetchActivitiesForPerson matched Activities count:",
    activityRecords.length
  );

  return activityRecords.map(mapActivityRecord);
}

export interface PendingReviewCounts {
  applications: number;
  hours: number;
  activitiesInProgress: number;
}
