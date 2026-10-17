import { asStringArray, escapeFormulaString, getRecord, listAllRecords, updateRecord } from "./client";

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
  /** Reverse links, named as they appear on People in Airtable. */
  Claims?: string[];
  "Linked Contributions"?: string[];
  "Linked Submissions"?: string[];
}

export interface Person {
  id: string;
  createdTime: string;
  fields: PersonFields;
  role: string | null;
  firstName: string | null;
}

export interface PersonProfileUpdate {
  discord?: string | null;
  birthday?: string | null;
  gender?: string | null;
  state?: string | null;
  country?: string | null;
}

export function mapPersonRecord(record: { id: string; createdTime: string; fields: PersonFields }): Person {
  const latestRole = record.fields["Latest Role"];
  const role = Array.isArray(latestRole)
    ? latestRole.find((item) => typeof item === "string" && item.trim()) ?? null
    : null;
  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    role,
    firstName: record.fields["First Name"]?.trim() || null,
  };
}

export function getPersonTemplateName(person: Person): string {
  return person.firstName?.trim() || person.fields["First Name"]?.trim() || "";
}

export async function fetchAllPeople(): Promise<Person[]> {
  return (await listAllRecords<PersonFields>("People")).map(mapPersonRecord);
}

export async function getPersonByEmailDirect(email: string): Promise<Person | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const records = await listAllRecords<PersonFields>("People", {
    filterByFormula: `LOWER({Email})=LOWER('${escapeFormulaString(trimmed)}')`,
  });
  return records[0] ? mapPersonRecord(records[0]) : null;
}

export async function updatePersonProfile(id: string, update: PersonProfileUpdate): Promise<Person> {
  const fields: Record<string, unknown> = {};
  if (update.discord !== undefined) fields.Discord = update.discord;
  if (update.birthday !== undefined) fields.Birthday = update.birthday;
  if (update.gender !== undefined) fields.Gender = update.gender;
  if (update.state !== undefined) fields.State = update.state;
  if (update.country !== undefined) fields.Country = update.country;
  const record = await updateRecord("People", id, fields);
  return mapPersonRecord({ id: record.id, createdTime: "", fields: record.fields as PersonFields });
}

export async function getPersonById(id: string): Promise<Person | null> {
  const record = await getRecord<PersonFields>("People", id);
  return record ? mapPersonRecord(record) : null;
}

export function personLinkedIds(person: Person | null | undefined, field: keyof PersonFields): string[] {
  return asStringArray(person?.fields[field]);
}
