/** Domain facade. Implementations live in the one-word `airtable` folder. */
export type { AirtableAttachment } from "./airtable/client";
export * from "./airtable/people";
export * from "./airtable/applications";
export * from "./airtable/hours";
export * from "./airtable/submissions";
export * from "./airtable/activities";
export * from "./airtable/contributions";
export * from "./airtable/claims";

export interface PendingReviewCounts {
  applications: number;
  hours: number;
  activitiesInProgress: number;
}
