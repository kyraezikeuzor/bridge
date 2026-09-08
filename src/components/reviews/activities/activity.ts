import type { Activity } from "@/lib/airtable";
import type { ReviewActivity } from "./types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" });

export function toReviewActivity(activity: Activity): ReviewActivity | null {
  if (!activity.status || !["Submitted", "Active", "Closed"].includes(activity.status)) {
    return null;
  }
  return {
    id: activity.id,
    activityName: activity.name,
    track: activity.track || "General",
    type: activity.type || "Other",
    description: activity.description || "",
    hoursValue: activity.hoursValue,
    spotsAvailable: Math.max(0, activity.slotsTotal - activity.slotsFilled),
    startDate: activity.startDate || undefined,
    endDate: activity.endDate || undefined,
    languages: activity.languages,
    status: activity.status as ReviewActivity["status"],
    filloutLink: activity.filloutLink || undefined,
  };
}

export function formatActivityDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

export function createDiscordPost(activity: ReviewActivity): string {
  const start = formatActivityDate(activity.startDate);
  const end = activity.endDate ? formatActivityDate(activity.endDate) : "";
  const claimUrl = activity.filloutLink || "CLAIM_FORM_URL";
  if (activity.track.toLowerCase() === "education") {
    return [
      "@Education Volunteer",
      "**New Volunteer Activity:**",
      activity.activityName || "Untitled Activity",
      "",
      activity.description || "No details provided.",
      "",
      "**Details:**",
      activity.languages.length ? `• Languages: ${activity.languages.join(", ")}` : null,
      `• Spots: ${activity.spotsAvailable} remaining`,
      `• Deadline: ${end || start}`,
      `• Hours: ${activity.hoursValue}`,
      "",
      "**How to claim:**",
      `1. Claim this activity first: [Claim Activity](${claimUrl})`,
      "2. Click the activity in Bridge to see the full instructions",
      "3. Complete the activity sections",
      "4. Log your hours in Bridge",
    ].filter((line): line is string => line !== null).join("\n");
  }
  const dates = !end || end === start ? start : `${start}–${end}`;
  return `@${activity.track} Volunteer\n${activity.activityName}\n\n${activity.description || "No details provided."}\nSpots: ${activity.spotsAvailable}\nDates: ${dates}\nHours: ${activity.hoursValue}\n\nClaim this activity first: [Claim Activity](${claimUrl})\n`;
}
