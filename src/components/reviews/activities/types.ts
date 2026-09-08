import type { ReviewActivityStatus } from "@/lib/leader-types";

export type ReviewActivity = {
  id: string;
  activityName: string;
  track: string;
  type: string;
  description: string;
  hoursValue: number;
  spotsAvailable: number;
  startDate?: string;
  endDate?: string;
  languages: string[];
  status: ReviewActivityStatus;
  filloutLink?: string;
};
