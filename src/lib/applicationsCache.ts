import {
  fetchAllApplications,
  fetchApplicationsByStatus,
  fetchInboxApplications,
  type Application,
  type ApplicationStatus,
} from "@/lib/airtable";
import { invalidateTable } from "@/lib/airtable/client";

/** Clear the cached inbox, e.g. after an edit made directly in Airtable. */
export async function refreshApplicationsCache(): Promise<void> {
  invalidateTable("Applications");
}

/**
 * Submitted applications come from the small cached inbox. Other statuses
 * are history: they are loaded on demand and never cached, because the full
 * table is thousands of rows and too large for the shared cache.
 */
export async function getApplications(
  status?: ApplicationStatus | "All" | null
): Promise<Application[]> {
  if (status === "Submitted") return fetchInboxApplications();
  if (!status || status === "All") return fetchAllApplications();
  return fetchApplicationsByStatus(status);
}
