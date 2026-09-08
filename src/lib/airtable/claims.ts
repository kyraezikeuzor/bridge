import { asStringArray, listAllRecords } from "./client";
import { fetchActivitiesForPerson, fetchAllActivities, type Activity } from "./activities";
import { fetchAllContributions, type Contribution } from "./contributions";

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
  "External Claim ID"?: string;
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
  /** Derived from the Claim and its qualifying Contribution(s). */
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
    status: record.fields.Status?.trim() || "Active",
    claimedAt: record.fields["Claimed At"]?.trim() || record.createdTime,
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
    // A list-and-filter avoids depending on the name Airtable chooses for the
    // reverse link on People. Claims are expected to be a small commitment
    // table, and this keeps the migration compatible with the current base.
    const records = await listAllRecords<ClaimFields>("Claims");
    const claims: Claim[] = [];
    for (const record of records) {
      const claim = mapClaimRecord(record);
      if (claim.personId === id) claims.push(claim);
    }
    return claims;
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
  const id = personId.trim();
  if (!id) return [];

  const [claims, legacyActivities, contributions, activities] = await Promise.all([
    fetchClaimsForPerson(id),
    fetchActivitiesForPerson(id),
    fetchAllContributions(),
    fetchAllActivities(),
  ]);
  const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
  const claimedActivityIds = new Set<string>();
  const contributionByClaim = new Map<string, Contribution>();
  const contributionByActivity = new Map<string, Contribution>();
  for (const contribution of contributions) {
    if (contribution.personId !== id) continue;
    if (contribution.claimId && !contributionByClaim.has(contribution.claimId)) {
      contributionByClaim.set(contribution.claimId, contribution);
    }
    if (
      contribution.activityId &&
      !contributionByActivity.has(contribution.activityId)
    ) {
      contributionByActivity.set(contribution.activityId, contribution);
    }
  }

  const completionStateFor = (claim: Pick<ClaimedActivity, "id" | "activityId" | "isLegacySignUp" | "status">): ClaimedActivity["completionState"] => {
    if (claim.status === "Completed") return "Completed";
    const contribution = claim.isLegacySignUp
      ? claim.activityId ? contributionByActivity.get(claim.activityId) : undefined
      : contributionByClaim.get(claim.id);
    if (contribution?.status === "Approved") return "Completed";
    if (contribution?.status === "Submitted") return "Submitted";
    return "In progress";
  };

  const firstClass = claims.map((claim) => {
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
      status: activity.status || "Active",
      claimedAt: activity.createdTime,
      externalClaimId: null,
      activity,
      isLegacySignUp: true,
      completionState: completionStateFor({ id: `legacy:${activity.id}:${id}`, activityId: activity.id, isLegacySignUp: true, status: activity.status || "Active" }),
    });
  }

  return [...firstClass, ...legacy].sort((a, b) =>
    b.claimedAt.localeCompare(a.claimedAt)
  );
}


