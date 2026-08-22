export type ApplicationStatus =
  | "Submitted"
  | "Interview"
  | "Accepted"
  | "Rejected";

export type HoursStatus = "Submitted" | "Approved" | "Rejected";

export type ReviewActivityStatus = "Submitted" | "Active" | "Closed";

export interface LeaderProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  discord: string;
  birthday: string;
  gender: string;
  state: string;
  country: string;
  joined: string;
}

export interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  type: string;
  department: string[];
  status: ApplicationStatus;
  applicationDate: string;
  school?: string;
  state?: string;
  country?: string;
}

export interface HoursRequest {
  id: string;
  volunteerName: string;
  email: string;
  activityName: string;
  department: string;
  hours: number;
  status: HoursStatus;
  submittedAt: string;
}

export interface ReviewActivity {
  id: string;
  activityName: string;
  track: string;
  type: string;
  description: string;
  hoursValue: number;
  spotsAvailable: number;
  startDate: string;
  endDate: string;
  languages?: string[];
  status: ReviewActivityStatus;
  filloutLink?: string;
}
