import { asStringArray, cachedRecords, hasStringValue } from "./client";
import { fetchAllActivities, type Activity } from "./activities";
import { fetchHoursForPerson, type HoursRequest } from "./hours";
import { completionStateFromHours, hoursBelongsToClaim } from "../workReview";

// ——— Claims ———

/**
 * Claims are commitments to an Activity. They deliberately do not replace the
 * existing Activity."Linked Sign Ups" relationship: that field remains the
 * compatibility source while the external activity board is moved over.
 */
export interface ClaimFields {
  "Linked Person"?: string[];
  "Linked Activity"?: string[];
  Status?: string;
  "Claimed At"?: string;
  "Claimed Date"?: string;
  "External Claim ID"?: string;
  "Linked Project"?: string[];
}

export interface Claim {
  id: string;
  createdTime: string;
  fields: ClaimFields;
  personId: string | null;
  activityId: string | null;
  status: string;
  claimedAt: string;
  externalClaimId: string | null;
}

export interface ClaimedActivity extends Claim {
  activity: Activity | null;
  /** True only for a temporary, read-only compatibility claim. */
  isLegacySignUp: boolean;
  /** Hours is the single source of truth for work review and completion. */
  completionState: "In progress" | "Submitted" | "Completed";
}

function mapClaimRecord(record: {
  id: string;
  createdTime: string;
  fields: ClaimFields;
}): Claim {
  return {
    id: record.id,
    createdTime: record.createdTime,
    fields: record.fields,
    personId: asStringArray(record.fields["Linked Person"])[0] ?? null,
    activityId: asStringArray(record.fields["Linked Activity"])[0] ?? null,
    status: record.fields.Status?.trim() || "Claimed",
    claimedAt: record.fields["Claimed Date"]?.trim() || record.fields["Claimed At"]?.trim() || record.createdTime,
    externalClaimId: record.fields["External Claim ID"]?.trim() || null,
  };
}

function isMissingClaimsTableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Airtable Claims list failed (404)")
  );
}

/** Fetch only actual, first-class Claims for a person. */
export async function fetchClaimsForPerson(personId: string): Promise<Claim[]> {
  const id = personId.trim();
  if (!id) return [];

  try {
    // Match the source-of-truth link on Claims. Airtable reverse-link field
    // names on People can vary between bases and may be absent during setup.
    const records = await cachedRecords<ClaimFields>("Claims");
    return records.map(mapClaimRecord).filter((claim) => claim.personId === id);
  } catch (error) {
    // Deploying the app before the additive table is created must not hide
    // existing sign-ups. The setup script creates this table before backfill.
    if (isMissingClaimsTableError(error)) {
      console.warn("[airtable] Claims table is not installed; using legacy sign-ups");
      return [];
    }
    throw error;
  }
}

/**
 * Returns claims joined to their Activities, plus synthetic read-only claims
 * for any old Linked Sign Ups not yet backfilled. Actual Claims always win for
 * an activity, so callers can rely on a stable commitment id once it exists.
 */
export async function fetchClaimedActivitiesForPerson(
  personId: string
): Promise<ClaimedActivity[]> {
  return (await fetchPersonWork(personId)).claimed;
}

export interface PersonWork {
  claimed: ClaimedActivity[];
  hours: HoursRequest[];
}

/**
 * Everything the volunteer dashboard needs. Each table comes from the shared
 * cache, so a warm request makes no Airtable calls.
 */
export async function fetchPersonWork(personId: string): Promise<PersonWork> {
  const id = personId.trim();
  if (!id) return { claimed: [], hours: [] };

  const [allActivities, claims, hours] = await Promise.all([
    fetchAllActivities(),
    fetchClaimsForPerson(id),
    fetchHoursForPerson(id),
  ]);
  const activitiesById = new Map(allActivities.map((activity) => [activity.id, activity]));
  const legacyActivities = allActivities.filter((activity) =>
    hasStringValue(activity.fields["Linked Sign Ups"], id)
  );
  const claimedActivityIds = new Set<string>();
  const completionStateFor = (claim: Pick<ClaimedActivity, "id" | "activityId" | "isLegacySignUp" | "status">): ClaimedActivity["completionState"] => {
    return completionStateFromHours(claim.status, hours.filter((row) => hoursBelongsToClaim(row, claim)));
  };

  // Even a cancelled physical claim suppresses its old legacy signup link.
  for (const claim of claims) if (claim.activityId) claimedActivityIds.add(claim.activityId);
  const firstClass = claims.filter((claim) => claim.status !== "Cancelled").map((claim) => {
    if (claim.activityId) claimedActivityIds.add(claim.activityId);
    return { ...claim, activity: claim.activityId ? activitiesById.get(claim.activityId) ?? null : null, isLegacySignUp: false, completionState: completionStateFor({ ...claim, isLegacySignUp: false }) };
  });

  const legacy: ClaimedActivity[] = [];
  for (const activity of legacyActivities) {
    if (claimedActivityIds.has(activity.id)) continue;
    legacy.push({
      id: `legacy:${activity.id}:${id}`,
      createdTime: activity.createdTime,
      fields: { "Linked Person": [id], "Linked Activity": [activity.id] },
      personId: id,
      activityId: activity.id,
      // A legacy link only records that the person signed up; the activity's
      // own status (Open, Closed, …) says nothing about this commitment.
      status: "Claimed",
      claimedAt: activity.createdTime,
      externalClaimId: null,
      activity,
      isLegacySignUp: true,
      completionState: completionStateFor({ id: `legacy:${activity.id}:${id}`, activityId: activity.id, isLegacySignUp: true, status: "Claimed" }),
    });
  }

  const claimed = [...firstClass, ...legacy].sort((a, b) =>
    b.claimedAt.localeCompare(a.claimedAt)
  );
  return { claimed, hours };
}
