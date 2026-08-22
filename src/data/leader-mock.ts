import type {
  Application,
  HoursRequest,
  ReviewActivity,
} from "@/lib/leader-types";

export const homeStats = {
  pendingApplications: 0,
  pendingHours: 0,
};

export const applications: Application[] = [
  {
    id: "app-1",
    firstName: "Maya",
    lastName: "Chen",
    email: "maya.chen@example.com",
    type: "Volunteer",
    department: ["Education"],
    status: "Interview",
    applicationDate: "2026-07-10",
    school: "Lincoln High",
    state: "CA",
    country: "United States",
  },
  {
    id: "app-2",
    firstName: "Diego",
    lastName: "Santos",
    email: "diego.santos@example.com",
    type: "Volunteer",
    department: ["Fundraising"],
    status: "Accepted",
    applicationDate: "2026-06-28",
    school: "Westview Academy",
    state: "TX",
    country: "United States",
  },
  {
    id: "app-3",
    firstName: "Aisha",
    lastName: "Patel",
    email: "aisha.patel@example.com",
    type: "Volunteer",
    department: ["Programs", "Supplies"],
    status: "Rejected",
    applicationDate: "2026-06-15",
    school: "Oak Ridge HS",
    state: "NY",
    country: "United States",
  },
];

export const hoursRequests: HoursRequest[] = [
  {
    id: "hr-1",
    volunteerName: "Jordan Lee",
    email: "jordan.lee@example.com",
    activityName: "Goal Statement Workshop",
    department: "Education",
    hours: 2,
    status: "Approved",
    submittedAt: "2026-07-20",
  },
  {
    id: "hr-2",
    volunteerName: "Sam Rivera",
    email: "sam.rivera@example.com",
    activityName: "School Supply Kit Packing",
    department: "Supplies",
    hours: 2,
    status: "Rejected",
    submittedAt: "2026-07-18",
  },
];

export const reviewActivities: ReviewActivity[] = [
  {
    id: "ra-1",
    activityName: "Submit Coloring Pages (3)",
    track: "Education",
    type: "Coloring Pages",
    description:
      "Create and submit 3 original coloring pages for elementary partners. Use the brand kit line weights.",
    hoursValue: 1,
    spotsAvailable: 5,
    startDate: "2026-07-25",
    endDate: "2026-07-30",
    languages: ["English - EN"],
    status: "Active",
    filloutLink: "https://form.fillout.com/t/xq7hnW23BWus",
  },
  {
    id: "ra-2",
    activityName: "Propose a Service Center",
    track: "Supplies",
    type: "Other",
    description:
      "Research and propose a local service center location for supply distribution.",
    hoursValue: 5,
    spotsAvailable: 100,
    startDate: "2026-07-25",
    endDate: "2026-12-30",
    status: "Active",
  },
  {
    id: "ra-3",
    activityName: "Peer Tutoring Office Hours",
    track: "Education",
    type: "Virtual",
    description: "Host a 1-hour tutoring block for assigned mentees.",
    hoursValue: 1,
    spotsAvailable: 4,
    startDate: "2026-08-01",
    endDate: "2026-08-08",
    languages: ["English - EN", "Spanish - ES"],
    status: "Submitted",
  },
  {
    id: "ra-4",
    activityName: "Fall Fundraiser Kickoff Post",
    track: "Fundraising",
    type: "Campaign",
    description: "Draft and schedule the fall fundraiser kickoff Discord post.",
    hoursValue: 1,
    spotsAvailable: 2,
    startDate: "2026-07-01",
    endDate: "2026-07-15",
    status: "Closed",
  },
];

export const quickLinks = [
  {
    title: "Launch Discord",
    description: "Connect with the community",
    image:
      "https://images.fillout.com/orgid-737092/flowpublicid-uti4bix9xv/widgetid-default/u9F6PjJ6UZFHwmot9kMUfP/pasted-image-1782351628866-dlk3s59b.png",
    href: "https://discord.gg/VfARrtgpHG",
  },
  {
    title: "Omelora Website",
    description: "Visit our main site",
    href: "https://omelora.org",
    icon: "globe" as const,
  },
];

export const addActivityLinks = [
  {
    label: "Add Activity",
    href: "https://form.fillout.com/t/xq7hnW23BWus",
  },
];
