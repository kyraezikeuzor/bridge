import { asStringArray, getRecord, listAllRecords, updateRecord, createRecord } from "./airtable/client";
import { withProjectLock } from "./projectService";

export class ClaimError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

type ClaimFields = {
  "Linked Person"?: string[];
  "Linked Activity"?: string[];
  Status?: string;
};

const OCCUPYING = new Set(["claimed", "in progress", "pending review", "completed"]);
const SIGNUP_STATUSES = new Set(["open", "active", "full"]);

function isOccupying(status: string | undefined) {
  return OCCUPYING.has((status?.trim() || "Claimed").toLowerCase());
}

/**
 * Sign a volunteer up for an activity from the public Activities board.
 * Safe to retry: an existing signup is returned as is. Capacity counts
 * occupying Claims plus legacy Linked Sign Ups, matching the Activities app.
 * Reads Airtable fresh (not the 60s cache) because it decides capacity.
 */
export async function claimActivity(personId: string, activityId: string): Promise<{ claimId: string; created: boolean }> {
  if (!/^rec[a-zA-Z0-9]+$/.test(activityId)) throw new ClaimError("Choose a valid activity.", 400);

  return withProjectLock(`activity:${activityId}`, async () => {
    const [activity, claimRecords] = await Promise.all([
      getRecord<Record<string, unknown>>("Activities", activityId),
      listAllRecords<ClaimFields>("Claims"),
    ]);
    if (!activity) throw new ClaimError("This activity no longer exists.", 404);

    const forActivity = claimRecords.filter((record) => asStringArray(record.fields["Linked Activity"]).includes(activityId));
    const mine = forActivity
      .filter((record) => asStringArray(record.fields["Linked Person"]).includes(personId))
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime));

    const existing = mine.find((record) => isOccupying(record.fields.Status));
    if (existing) return { claimId: existing.id, created: false };

    const status = String(activity.fields.Status || "").trim().toLowerCase();
    if (!SIGNUP_STATUSES.has(status)) throw new ClaimError("This activity isn't open for signups.");

    // People who hold a Claim (any status) are counted by their Claims only.
    const claimants = new Set(forActivity.flatMap((record) => asStringArray(record.fields["Linked Person"])));
    const occupying = new Set(
      forActivity.filter((record) => isOccupying(record.fields.Status)).flatMap((record) => asStringArray(record.fields["Linked Person"]))
    );
    const legacyOnly = asStringArray(activity.fields["Linked Sign Ups"]).filter((id) => !claimants.has(id));
    const filled = occupying.size + new Set(legacyOnly).size;
    const max = activity.fields["Slots Max"] ?? activity.fields["Slots Total"];
    const capacity = typeof max === "number" && max > 0 ? max : null;
    if (status === "full" || (capacity !== null && filled >= capacity)) throw new ClaimError("This activity is full.");

    const cancelled = mine.find((record) => !isOccupying(record.fields.Status));
    if (cancelled) {
      await updateRecord("Claims", cancelled.id, { Status: "Claimed" });
      return { claimId: cancelled.id, created: false };
    }
    const created = await createRecord("Claims", {
      "Linked Person": [personId],
      "Linked Activity": [activityId],
      Status: "Claimed",
      "Claimed Date": new Date().toISOString(),
    });
    return { claimId: created.id, created: true };
  });
}
