import {
  fetchAllActivities,
  fetchClaimedActivitiesForPerson,
  type Activity,
  type ClaimedActivity,
} from "@/lib/airtable";
import { invalidateTable } from "@/lib/airtable/client";

/** Activities reads come from the shared table cache in airtable/client.ts. */
export async function refreshActivitiesCache(): Promise<void> {
  invalidateTable("Activities");
}

/** Activities the person has claimed, plus legacy sign-ups not yet backfilled. */
export async function getPersonActivities(personId: string): Promise<ClaimedActivity[]> {
  return fetchClaimedActivitiesForPerson(personId);
}

export async function getAllActivities(): Promise<Activity[]> {
  return fetchAllActivities();
}
