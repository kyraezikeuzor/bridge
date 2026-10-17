import { cachedRecords, invalidateTable, asStringArray, createRecord, formatTrack, getConfig, listRecordsByIds, type AirtableAttachment } from "./client";
import { getPersonById, personLinkedIds } from "./people";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";
type ClaimReference = { id: string; activityId: string | null; isLegacySignUp: boolean };

export interface SubmissionFields {
  "Activity Name(s)"?: string[];
  Attachment?: AirtableAttachment[];
  Content?: string;
  "Linked Activity"?: string[];
  "Linked Hours Requests"?: string[];
  /** Reverse of the direct Hours.Linked Submissions relationship. */
  Hours?: string[];
  "Linked Person"?: string[];
  "Linked Claim"?: string[];
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
  personId: string | null;
  activityId: string | null;
  claimId: string | null;
}

export function mapSubmissionRecord(record: {
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
    files: attachments.reduce<SubmissionFile[]>((files, attachment) => {
      if (attachment?.url) {
        files.push({
          url: attachment.url,
          filename: attachment.filename || "Attachment",
        });
      }
      return files;
    }, []),
    hoursRequestIds: asStringArray(record.fields.Hours ?? record.fields["Linked Hours Requests"]),
    personId: asStringArray(record.fields["Linked Person"])[0] ?? null,
    activityId: asStringArray(record.fields["Linked Activity"])[0] ?? null,
    claimId: asStringArray(record.fields["Linked Claim"])[0] ?? null,
  };
}

export async function fetchAllSubmissions(): Promise<Submission[]> {
  const records = await cachedRecords<SubmissionFields>("Submissions");
  return records.map(mapSubmissionRecord);
}

/** Draft artifacts saved from a specific Activity Viewer claim. */
export async function fetchSubmissionsForClaim(
  personId: string,
  claim: ClaimReference
): Promise<Submission[]> {
  // People."Linked Submissions" is the reverse of Submissions."Linked Person".
  const ids = personLinkedIds(await getPersonById(personId), "Linked Submissions");
  const records = await listRecordsByIds<SubmissionFields>("Submissions", ids);
  return records
    .map(mapSubmissionRecord)
    .filter(
      (submission) =>
        submission.personId === personId &&
        // A legacy sign-up has no physical Claim, so match its activity instead.
        (claim.isLegacySignUp
          ? submission.activityId === claim.activityId
          : submission.claimId === claim.id)
    )
    .sort((a, b) => (a.submittedDate || "").localeCompare(b.submittedDate || ""));
}

export async function createSubmission(input: {
  personId: string;
  claim: ClaimReference;
  content?: string | null;
}): Promise<Submission> {
  if (!input.claim.activityId) throw new Error("This claim is not linked to an activity");
  const fields: Record<string, unknown> = {
    "Linked Person": [input.personId],
    "Linked Activity": [input.claim.activityId],
    Status: "Submitted",
    "Submitted Date": new Date().toISOString().slice(0, 10),
  };
  if (!input.claim.isLegacySignUp) fields["Linked Claim"] = [input.claim.id];
  if (input.content) fields.Content = input.content;
  const record = await createRecord("Submissions", fields);
  return mapSubmissionRecord({ id: record.id, fields: record.fields as SubmissionFields });
}

let submissionAttachmentFieldId: string | null | undefined;

/** Upload a local file through Airtable's attachment-content endpoint. */
export async function uploadSubmissionAttachment(input: {
  submissionId: string;
  filename: string;
  contentType: string;
  base64: string;
}): Promise<SubmissionFile> {
  const { apiKey, baseId } = getConfig();
  if (submissionAttachmentFieldId === undefined) {
    const schemaResponse = await fetch(`${AIRTABLE_API_URL}/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store",
    });
    if (!schemaResponse.ok) throw new Error("Unable to find the Submissions Attachment field");
    const schema = await schemaResponse.json() as { tables: Array<{ name: string; fields: Array<{ id: string; name: string }> }> };
    submissionAttachmentFieldId = schema.tables.find((table) => table.name === "Submissions")?.fields.find((field) => field.name === "Attachment")?.id ?? null;
  }
  if (!submissionAttachmentFieldId) throw new Error("Submissions is missing its Attachment field");
  const response = await fetch(`https://content.airtable.com/v0/${baseId}/${input.submissionId}/${submissionAttachmentFieldId}/uploadAttachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: input.contentType, filename: input.filename, file: input.base64 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Airtable attachment upload failed (${response.status}): ${await response.text()}`);
  const body = await response.json() as { attachment?: { url?: string; filename?: string } };
  if (!body.attachment?.url) throw new Error("Airtable did not return the uploaded attachment");
  invalidateTable("Submissions");
  return { url: body.attachment.url, filename: body.attachment.filename || input.filename };
}
