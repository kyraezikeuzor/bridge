import { DISCORD_INVITE_URL } from "@/lib/links";

export type UserRole = "volunteer" | "leader";

export interface AppUser {
  id: string;
  role: UserRole;
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

export const HOURS_REQUEST_FORM_URL = "https://form.fillout.com/t/eL6dML97A7us";
export const CLAIM_ACTIVITIES_URL = "https://activities.omelora.org";
export const SUBMIT_WORK_FORM_URL =
  "https://form.fillout.com/t/3E1RS4nnPtus?activity_id=recK2gHSUgOMgvAZJ";

export const volunteerStats = {
  approvedHoursThisMonth: 0,
  pendingSubmissions: 0,
  claimedTasks: 0,
};

export const volunteerQuickLinks = [
  {
    title: "Volunteer Activities Board",
    description: "Browse new activities to claim",
    href: CLAIM_ACTIVITIES_URL,
    icon: "zap" as const,
  },
  {
    title: "Discord Community",
    description: "Connect with more volunteers",
    href: DISCORD_INVITE_URL,
    icon: "discord" as const,
  },
  {
    title: "Volunteer Starter Guide",
    description: "Guidelines, policies & FAQs",
    href: "https://docs.google.com/document/d/13IkUv86rqqOoMiHfIYpD14Gnfx3fIHxws4kL3N7ywqw/edit?usp=sharing",
    icon: "book" as const,
  },
];
