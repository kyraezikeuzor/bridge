import { prisma } from "./prisma";
import { asStringArray, getRecord, listAllRecords, reserveRecord, updateRecord } from "./airtable/client";
import { getPersonById } from "./airtable/people";
import { ACTION_MODEL, getProject, mapProject, type ProjectFields } from "./airtable/projects";
import { canEditProject, createsProject, minimumQuantity, projectTitle, reviewTransition, submissionError, type DeliveryMethod } from "./projectRules";

export class ProjectError extends Error {}
/** The existing auth Postgres supplies a distributed lock only; project data remains in Airtable.
 * All Bridge writers use this lock. Airtable itself has no multi-record transaction.
 */
export async function withProjectLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bridge-project:${key}`}, 0))::text`;
    return action();
  }, { maxWait: 10000, timeout: 45000 });
}
export async function startProject(personId: string, activityId: string) {
  if (!/^rec[a-zA-Z0-9]+$/.test(activityId)) throw new ProjectError("Choose a valid activity.");
  return withProjectLock(`activity:${activityId}`, async () => {
    const key = `${ACTION_MODEL}:${activityId}:${personId}`;
    const existing = await listAllRecords<ProjectFields>("Projects", { filterByFormula: `{Project Key}='${key}'` });
    if (existing.length > 1) throw new ProjectError("This signup needs a director's attention.");
    if (existing[0]?.fields["Linked Signup"]) return mapProject(existing[0]);
    const activity = await getRecord<Record<string, unknown>>("Activities", activityId);
    const f = activity?.fields;
    if (!f || !createsProject(String(f.Type || ""), f["Creates Project"] === true) || f.Status !== "Active") throw new ProjectError("This activity is not open for project signups.");
    if (typeof f["End Date"] === "string" && f["End Date"].slice(0, 10) < new Date().toISOString().slice(0, 10)) throw new ProjectError("This activity's deadline has passed.");
    const centerId = asStringArray(f["Linked Service Center"])[0];
    const center = centerId ? await getRecord<Record<string, unknown>>("Partnerships", centerId) : null;
    if (!center || !asStringArray(center.fields.Status).includes("Accepted")) throw new ProjectError("A director must confirm the service center before signups open.");
    const current = await listAllRecords<ProjectFields>("Projects", { filterByFormula: `AND({Action Model}='${ACTION_MODEL}',{Activity Record ID}='${activityId}')` });
    const capacity = typeof f["Project Capacity"] === "number" ? f["Project Capacity"] : 5;
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new ProjectError("This activity needs a valid capacity.");
    if (!existing.length && current.filter(p => p.fields["Action State"] !== "Cancelled").length >= capacity) throw new ProjectError("All project slots are filled.");
    const person = await getPersonById(personId);
    if (!person) throw new ProjectError("Your volunteer profile is unavailable.");
    const reservation = existing[0] || await reserveRecord("Projects", "Project Key", key);
    if (!reservation.fields["Action Model"]) {
      await updateRecord("Projects", reservation.id, {
        "Action Model": ACTION_MODEL, "Project Name": projectTitle(person.fields["First Name"] || "", person.fields["Last Name"] || "", String(f["Activity Name"] || "Project"), String(center.fields.Name || "Center")),
        "Action State": "In Progress", "Linked Volunteer": [personId], "Volunteer Record ID": personId,
        "Activity Record ID": activityId, Activities: [activityId], "Linked Center": [centerId],
        "Action Category": String(f["Project Category"] || (f.Type === "Participation" && (!f.Category || f.Category === "Other") ? "Service Day" : f.Category || "Other")),
        "Center Location": String(center.fields.Location || ""), "Center Country": String(center.fields.Country || ""), "Project Deadline": String(f["End Date"] || ""),
        "Minimum Quantity": minimumQuantity(String(f.Category || "Other"), Number(f["Project Minimum Quantity"]) || undefined),
      });
    }
    const claim = await reserveRecord("Claims", "Signup Key", key);
    if (asStringArray(claim.fields["Linked Person"]).some(id => id !== personId)) throw new ProjectError("Signup identity mismatch.");
    if (!asStringArray(claim.fields["Linked Project"]).includes(reservation.id)) await updateRecord("Claims", claim.id, {
      "Linked Person": [personId], "Linked Activity": [activityId], "Linked Project": [reservation.id],
      Status: "Claimed", "Claimed Date": new Date().toISOString(),
    });
    await updateRecord("Projects", reservation.id, { "Linked Signup": [claim.id] });
    return mapProject((await getProject(reservation.id))!);
  });
}

export async function proposeProject(personId: string, input: Record<string, unknown>) {
  const read = (key: string, max: number, required = true) => {
    const value = input[key];
    if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new ProjectError(`Check ${key}.`);
    return value.trim();
  };
  const requestId = read("requestId", 100), title = read("title", 150), organization = read("organization", 200);
  const contactName = read("contactName", 150), contactEmail = read("contactEmail", 254), contactPhone = read("contactPhone", 50, false);
  const need = read("need", 5000), completionDate = read("completionDate", 10);
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) throw new ProjectError("Enter a valid organization or adult contact email.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate) || completionDate < new Date().toISOString().slice(0, 10)) throw new ProjectError("Choose a future completion date.");
  const cost = input.cost;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0 || cost > 100000) throw new ProjectError("Enter a valid estimated cost.");
  return withProjectLock(`proposal:${personId}:${requestId}`, async () => {
    const key = `EducationActionProposal:${personId}:${requestId}`;
    const reservation = await reserveRecord("Projects", "Project Key", key);
    if (reservation.fields["Linked Volunteer"] && !asStringArray(reservation.fields["Linked Volunteer"]).includes(personId)) throw new ProjectError("Proposal identity mismatch.");
    if (!reservation.fields["Action Model"]) await updateRecord("Projects", reservation.id, {
      "Action Model": ACTION_MODEL, "Project Name": title, "Action State": "Proposed", "Linked Volunteer": [personId],
      "Volunteer Record ID": personId, "Proposal Organization": organization, "Proposal Contact Name": contactName,
      "Proposal Contact Email": contactEmail, "Proposal Contact Phone": contactPhone, "Proposal Need": need,
      "Proposal Cost": cost, "Proposal Completion Date": completionDate, "Project Deadline": completionDate,
      "Project Work": "Proposal submitted for director review. No work or purchases are approved yet.",
    });
    return mapProject((await getProject(reservation.id))!);
  });
}

export async function reviewProposal(reviewerId: string, id: string, action: string, note: string) {
  return withProjectLock(id, async () => {
    const reviewer = await getPersonById(reviewerId);
    if (!reviewer || !/^(Executive Director|Track Director)$/i.test(reviewer.role || "")) throw new ProjectError("A director must review this proposal.");
    const record = await getProject(id);
    if (!record) throw new ProjectError("Proposal not found.");
    const project = mapProject(record);
    if (project.ownerId === reviewerId) throw new ProjectError("Another director must review your proposal.");
    if (project.state !== "Proposed") throw new ProjectError("This proposal has already been reviewed.");
    if (!note.trim() || note.length > 5000) throw new ProjectError("Add a proposal review note (up to 5,000 characters).");
    const next = action === "approve-proposal" ? "Proposal Approved" : action === "reject-proposal" ? "Proposal Rejected" : null;
    if (!next) throw new ProjectError("This proposal review action is not available.");
    const now = new Date().toISOString();
    const history = readHistory(record.fields["Review History"]);
    history.push({ action, at: now, reviewerId, note });
    await updateRecord("Projects", id, {
      "Action State": next,
      "Project Review Notes": note.trim(),
      "Action Reviewer": [reviewerId],
      "Review History": JSON.stringify(history),
    });
    return mapProject((await getProject(id))!);
  });
}

export async function editProject(personId: string, id: string, input: Record<string, unknown>) {
  return withProjectLock(id, async () => {
    const record = await getProject(id);
    if (!record || !asStringArray(record.fields["Linked Volunteer"]).includes(personId)) throw new ProjectError("Project not found.");
    const project = mapProject(record);
    if (!canEditProject(project.state)) throw new ProjectError("Submitted evidence is locked while it is reviewed.");
    const read = (key: string, max: number) => {
      const value = input[key];
      if (typeof value !== "string" || value.length > max) throw new ProjectError(`Check ${key}.`);
      return value.trim();
    };
    const work = read("work", 60000), tracking = read("tracking", 500), confirmation = read("confirmation", 4000), reflection = read("reflection", 5000);
    const method = read("method", 40) as DeliveryMethod;
    if (!["Omelora mailing", "Shipped", "In person", "Service confirmation"].includes(method)) throw new ProjectError("Choose a delivery method.");
    const quantity = input.quantity, requestedHours = input.requestedHours;
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100000) throw new ProjectError("Enter a valid whole quantity.");
    if (typeof requestedHours !== "number" || !Number.isFinite(requestedHours) || requestedHours < 0 || requestedHours > 1000) throw new ProjectError("Enter valid requested hours.");
    if (input.action === "submit") {
      const issue = submissionError(project.category, project.minimum, { quantity, work, method, tracking, confirmation, itemPhotos: project.itemPhotos.length, deliveryPhotos: project.deliveryPhotos.length });
      if (issue) throw new ProjectError(issue);
    } else if (input.action !== "save") throw new ProjectError("Unknown project action.");
    const fields: Record<string, unknown> = { "Project Work": work, "Submitted Quantity": quantity, "Project Requested Hours": requestedHours, "Delivery Method": method, "Tracking Reference": tracking, "Center Confirmation": confirmation, Reflection: reflection };
    if (input.action === "submit") {
      fields["Action State"] = "Submitted";
      fields["Action Submitted At"] = new Date().toISOString();
      const history = readHistory(record.fields["Review History"]);
      // Each review attempt keeps a separate attachment-backed snapshot. Copying
      // attachments into Airtable preserves them beyond signed URL expiration.
      const snapshot = await reserveRecord("Submissions", "Evidence Key", `EducationAction:${id}:${history.length}`);
      if (!snapshot.fields["Linked Project"]) await updateRecord("Submissions", snapshot.id, {
        "Linked Project": [id], "Linked Person": [personId], "Linked Activity": [project.activityId], "Linked Claim": [project.claimId],
        "Evidence Type": "Project submission snapshot", "Submitted Date": new Date().toISOString().slice(0, 10), Status: "Submitted",
        Content: JSON.stringify({ work, quantity, requestedHours, method, tracking, confirmation, reflection }),
        Attachment: [...project.itemPhotos, ...project.deliveryPhotos].map(p => ({ url: p.url, filename: p.filename })),
      });
      fields["Project Evidence"] = [...asStringArray(record.fields["Project Evidence"]), snapshot.id].filter((id, i, ids) => ids.indexOf(id) === i);
      history.push({ action: "submit", at: fields["Action Submitted At"], personId, snapshotId: snapshot.id });
      fields["Review History"] = JSON.stringify(history);
    }
    await updateRecord("Projects", id, fields);
    return mapProject((await getProject(id))!);
  });
}
function readHistory(value: unknown): unknown[] {
  if (!value) return [];
  const history: unknown = JSON.parse(String(value));
  if (!Array.isArray(history)) throw new Error("Project history needs repair");
  return history;
}
export async function reviewProject(reviewerId: string, id: string, action: string, note: string, verifiedItems: number) {
  return withProjectLock(id, async () => {
    const reviewer = await getPersonById(reviewerId);
    if (!reviewer || !/^(Executive Director|Track Director)$/i.test(reviewer.role || "")) throw new ProjectError("A director must review this project.");
    const record = await getProject(id);
    if (!record) throw new ProjectError("Project not found.");
    const project = mapProject(record);
    if (project.ownerId === reviewerId) throw new ProjectError("Another director must review your project.");
    if (!note.trim() || note.length > 5000) throw new ProjectError("Add a review or verification note (up to 5,000 characters).");
    let next: string;
    try { next = reviewTransition(project.state, action, note); } catch (error) { throw new ProjectError((error as Error).message); }
    if (!Number.isSafeInteger(verifiedItems) || verifiedItems < 0 || verifiedItems > project.quantity) throw new ProjectError("Verified items must be between zero and the submitted quantity.");
    if (action === "complete" && project.category !== "Service Day" && verifiedItems < project.minimum) throw new ProjectError("The verified quantity does not meet the project minimum.");
    const now = new Date().toISOString();
    if (action === "complete") {
      // Separate Hours review: completing a project never auto-awards volunteer credit.
      const hours = await reserveRecord("Hours", "Work Reference", `EducationAction:${id}`);
      if (!hours.fields.Status) await updateRecord("Hours", hours.id, {
        "Linked Person": [project.ownerId], "Linked Activity": [project.activityId], "Linked Claim": [project.claimId], "Linked Project": [id],
        "Linked Submissions": asStringArray(record.fields["Project Evidence"]).slice(-1),
        Status: "Submitted", Hours: project.requestedHours, "Requested Hours": project.requestedHours,
        "Activity Details": `${project.name}\n${project.work}\nDelivery: ${project.method}\n${project.tracking}\n${project.confirmation}\nVerification: ${note}`,
        "Proof": [...project.itemPhotos, ...project.deliveryPhotos].map(p => ({ url: p.url, filename: p.filename })),
        "Completed Date": now, "Submitted Date": now, "Request Date": now.slice(0, 10),
        Platform: "Bridge", "Work Type": "Education Action Project", Quantity: verifiedItems,
      });
    }
    const history = readHistory(record.fields["Review History"]);
    history.push({ action, at: now, reviewerId, note, verifiedItems });
    await updateRecord("Projects", id, {
      "Action State": next, "Project Review Notes": note, "Action Reviewer": [reviewerId], "Review History": JSON.stringify(history),
      ...(action === "complete" ? { "Action Completed At": now, "Verified Items": verifiedItems } : {}),
    });
    return mapProject((await getProject(id))!);
  });
}
