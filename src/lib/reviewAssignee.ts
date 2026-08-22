/**
 * Returns whether an Airtable review record is assigned to the signed-in user.
 * Airtable returns the Assignee field as a list of email values.
 */
export function isAssignedToEmail(
  assignees: readonly string[],
  email: string | null | undefined
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return assignees.some(
    (assignee) => assignee.trim().toLowerCase() === normalizedEmail
  );
}

/**
 * Supports both Airtable representations of Assignee: email lookup values and
 * linked People record IDs.
 */
export function isAssignedToReviewer(
  assignees: readonly string[],
  reviewer: ReviewerIdentity
): boolean {
  const personId = reviewer.personId?.trim();
  return (
    isAssignedToEmail(assignees, reviewer.email) ||
    Boolean(personId && assignees.some((assignee) => assignee === personId))
  );
}
import { getPersonByEmailDirect } from "@/lib/airtable";

export type ReviewerIdentity = {
  email?: string | null;
  personId?: string | null;
};

/** email → People record id. A person's record id is stable, so this is safe to hold. */
const reviewerIdByEmail = new Map<string, string>();

/** Resolve the current People record so linked Assignee fields always match. */
export async function resolveReviewerIdentity(
  reviewer: ReviewerIdentity
): Promise<ReviewerIdentity> {
  const email = reviewer.email?.trim();
  if (!email) return reviewer;

  const memo = reviewerIdByEmail.get(email.toLowerCase());
  if (memo) return { email, personId: memo };

  // Single filtered lookup (~0.3s) rather than warming the whole People cache,
  // which is a 3k-record / 31-request pull (~12s) just to resolve one email.
  const person = await getPersonByEmailDirect(email);
  if (person) reviewerIdByEmail.set(email.toLowerCase(), person.id);
  return { email, personId: person?.id ?? reviewer.personId };
}
