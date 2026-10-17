import {
  fetchAllHours,
  fetchHoursForPerson,
  summarizePersonHours,
  type HoursRequest,
  type HoursStatus,
  type PersonHoursSummary,
} from "@/lib/airtable";
import { invalidateTable } from "@/lib/airtable/client";

/**
 * Hours reads come from the shared table cache in airtable/client.ts.
 * Writes through Bridge clear it automatically; call this after a change
 * Bridge did not make itself, or to force fresh data.
 */
export async function refreshHoursCache(): Promise<void> {
  invalidateTable("Hours");
  invalidateTable("Submissions");
}

/** Hours requests, optionally filtered by Status. */
export async function getHoursRequests(
  status?: HoursStatus | "All" | null
): Promise<HoursRequest[]> {
  const rows = await fetchAllHours();
  if (!status || status === "All") return rows;
  return rows.filter((row) => row.status === status);
}

/** Hours summary for a volunteer, by People Airtable record id. */
export async function getPersonHours(personId: string): Promise<PersonHoursSummary> {
  return summarizePersonHours(await fetchHoursForPerson(personId));
}
