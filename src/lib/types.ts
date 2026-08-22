export const ACTIVITY_TRACKS = [
  "Education",
  "Fundraising",
  "Programs",
  "Supplies",
] as const;

export type ActivityTrack = (typeof ACTIVITY_TRACKS)[number];

export type ActivityStatus = "open" | "full";

export interface SignUp {
  id: string;
  profileId: string;
  firstName: string;
  lastInitial: string;
  spots: number;
  email: string;
}

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Activity {
  id: string;
  slug: string;
  title: string;
  track: ActivityTrack;
  type: string;
  description: string;
  location: string;
  hours: number;
  deadline: string;
  instructions: string;
  nextSteps: string;
  slotsTotal: number;
  /** Baseline sign-ups baked into mock data (before client-side adds). */
  signUps: SignUp[];
}
