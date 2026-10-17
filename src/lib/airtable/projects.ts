import { asStringArray, getRecord, listAllRecords, type AirtableRecord } from "./client";
import type { ProjectState, DeliveryMethod } from "../projectRules";

export const ACTION_MODEL = "Education Action v1";
export type ProjectFields = Record<string, unknown>;
const value = (f: ProjectFields, name: string) => typeof f[name] === "string" ? f[name] as string : "";
export function mapProject(record: AirtableRecord<ProjectFields>) {
  const f = record.fields;
  return {
    id: record.id, name: value(f, "Project Name"), state: value(f, "Action State") as ProjectState,
    ownerId: asStringArray(f["Linked Volunteer"])[0] || "", activityId: value(f, "Activity Record ID"),
    claimId: asStringArray(f["Linked Signup"])[0] || "", centerId: asStringArray(f["Linked Center"])[0] || "",
    category: value(f, "Action Category"), location: value(f, "Center Location"), deadline: value(f, "Project Deadline"),
    minimum: Number(f["Minimum Quantity"]) || 1, quantity: Number(f["Submitted Quantity"]) || 0,
    verifiedItems: Number(f["Verified Items"]) || 0, requestedHours: Number(f["Project Requested Hours"]) || 0, work: value(f, "Project Work"),
    method: value(f, "Delivery Method") as DeliveryMethod, tracking: value(f, "Tracking Reference"),
    confirmation: value(f, "Center Confirmation"), reflection: value(f, "Reflection"),
    itemPhotos: photos(f["Item Photos"]), deliveryPhotos: photos(f["Delivery Photos"]),
    reviewNotes: value(f, "Project Review Notes"), submittedAt: value(f, "Action Submitted At"),
    completedAt: value(f, "Action Completed At"), centerCountry: value(f, "Center Country"),
    proposalOrganization: value(f, "Proposal Organization"), proposalContactName: value(f, "Proposal Contact Name"),
    proposalContactEmail: value(f, "Proposal Contact Email"), proposalContactPhone: value(f, "Proposal Contact Phone"),
    proposalNeed: value(f, "Proposal Need"), proposalCost: Number(f["Proposal Cost"]) || 0,
    proposalCompletionDate: value(f, "Proposal Completion Date"),
  };
}
function photos(value: unknown): Array<{ url: string; filename: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is { url: string; filename: string } => Boolean(p && typeof p.url === "string" && typeof p.filename === "string"));
}
export type ActionProject = ReturnType<typeof mapProject>;
export async function fetchProjects() {
  return (await listAllRecords<ProjectFields>("Projects", { filterByFormula: `{Action Model}='${ACTION_MODEL}'` })).map(mapProject);
}
export async function getProject(id: string) {
  if (!/^rec[a-zA-Z0-9]+$/.test(id)) return null;
  const record = await getRecord<ProjectFields>("Projects", id);
  return record?.fields["Action Model"] === ACTION_MODEL ? record : null;
}
