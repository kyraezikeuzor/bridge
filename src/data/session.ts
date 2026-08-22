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

/** Active session user — currently set to volunteer. */
export const currentUser: AppUser = {
  id: "user-1",
  role: "volunteer",
  firstName: "Kyra",
  lastName: "Ezikeuzor",
  email: "kyraezikeuzor@gmail.com",
  discord: "Keeks#7881",
  birthday: "2007-01-12",
  gender: "Female",
  state: "Texas",
  country: "United States",
  joined: "",
};

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
    title: "Launch Discord",
    description: "Connect with the community",
    href: "https://discord.gg/VfARrtgpHG",
    icon: "discord" as const,
  },
  {
    title: "Omelora Website",
    description: "Visit our main site",
    href: "https://omelora.org",
    icon: "globe" as const,
  },
  {
    title: "Volunteer Starter Guide",
    description: "Guidelines, policies & FAQs",
    href: "https://docs.google.com/document/d/13IkUv86rqqOoMiHfIYpD14Gnfx3fIHxws4kL3N7ywqw/edit?usp=sharing",
    icon: "book" as const,
  },
  {
    title: "Volunteer Activities Board",
    description: "Open activities.omelora.org to claim a task",
    href: CLAIM_ACTIVITIES_URL,
    icon: "zap" as const,
  },
  {
    title: "Request Hours Form",
    description: "Submit volunteer hours for review",
    href: HOURS_REQUEST_FORM_URL,
    icon: "clipboard" as const,
  },
];
