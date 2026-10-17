/** Education Action rules; deliberately independent of historical claim/hour completion. */
export const PROJECT_STATES = ["Proposed", "Proposal Approved", "Proposal Rejected", "In Progress", "Changes Requested", "Submitted", "Awaiting Delivery", "Completed", "Cancelled"] as const;
export type ProjectState = typeof PROJECT_STATES[number];
export const PROJECT_CATEGORIES = ["Letters", "Care Kits", "School Kits", "Bookmarks", "Books", "Service Day", "Center Wish", "Other"] as const;
export type ProjectCategory = typeof PROJECT_CATEGORIES[number];
export type DeliveryMethod = "Omelora mailing" | "Shipped" | "In person" | "Service confirmation";

export function createsProject(type: string | null | undefined, enabled: boolean) {
  return enabled && (type === "Submission" || type === "Participation");
}
export function minimumQuantity(category: string, configured?: number) {
  const minimum = category === "Care Kits" || category === "School Kits" || category === "Letters" || category === "Bookmarks" ? 30 : category === "Books" ? 10 : 1;
  return Math.max(minimum, Number.isSafeInteger(configured) && configured! > 0 ? configured! : 0);
}
export function projectTitle(firstName: string, lastName: string, activity: string, center: string) {
  return [`${firstName.trim()}${lastName.trim() ? ` ${Array.from(lastName.trim())[0]}.` : ""}`.trim() || "Volunteer", activity.trim(), center.trim()].filter(Boolean).join(" — ");
}
export function canEditProject(state: string) {
  return state === "In Progress" || state === "Changes Requested";
}
export interface ProjectEvidence {
  quantity: number;
  work: string;
  method: DeliveryMethod;
  itemPhotos: number;
  deliveryPhotos: number;
  tracking: string;
  confirmation: string;
}
export function submissionError(category: string, minimum: number, evidence: ProjectEvidence): string | null {
  if (!Number.isSafeInteger(evidence.quantity) || evidence.quantity < minimum || evidence.quantity > 100000) return `Enter a whole quantity of at least ${minimum}.`;
  if (category === "Letters") {
    if (evidence.method !== "Omelora mailing") return "Letters must enter the Omelora mailing workflow.";
    if (!evidence.work.trim()) return "Add your letters before submitting.";
    return null;
  }
  if (category === "Service Day") {
    if (evidence.method !== "Service confirmation" || !evidence.confirmation.trim()) return "Add the center's service confirmation.";
    return null;
  }
  if (!evidence.itemPhotos) return "Upload a photo of the items.";
  if (evidence.method === "Shipped") return evidence.tracking.trim() ? null : "Add the carrier and tracking or mailing reference.";
  if (evidence.method === "In person") return evidence.deliveryPhotos || evidence.confirmation.trim() ? null : "Add a delivery photo with a consenting center associate, or a center confirmation if photography is not permitted.";
  return "Choose shipping or in-person delivery.";
}
export function reviewTransition(state: string, action: string, receipt: string): ProjectState {
  if (action === "request-changes" && (state === "Submitted" || state === "Awaiting Delivery")) return "Changes Requested";
  if (action === "approve-work" && state === "Submitted") return "Awaiting Delivery";
  if (action === "complete" && state === "Awaiting Delivery" && receipt.trim()) return "Completed";
  throw new Error("This review action is not available. Completion requires approved work and a delivery/service verification note.");
}
