import type { Activity, Profile } from "@/lib/types";

export const profiles: Profile[] = [
  {
    id: "p1",
    email: "jordan.lee@example.com",
    firstName: "Jordan",
    lastName: "Lee",
  },
  {
    id: "p2",
    email: "amaiya.okonkwo@example.com",
    firstName: "Amaiya",
    lastName: "Okonkwo",
  },
  {
    id: "p3",
    email: "sam.rivera@example.com",
    firstName: "Sam",
    lastName: "Rivera",
  },
  {
    id: "p4",
    email: "priya.sharma@example.com",
    firstName: "Priya",
    lastName: "Sharma",
  },
  {
    id: "p5",
    email: "chris.nguyen@example.com",
    firstName: "Chris",
    lastName: "Nguyen",
  },
];

export const activities: Activity[] = [
  {
    id: "a1",
    slug: "goal-statement-workshop",
    title: "Goal Statement Workshop",
    track: "Education",
    type: "Remote",
    description:
      "Help students draft a clear goal statement for their volunteer project. Review examples and leave constructive comments.",
    location: "Remote · Discord",
    hours: 2,
    deadline: "2026-08-15",
    instructions:
      "1. Claim this activity.\n2. Open the shared doc linked in Discord #education.\n3. Complete Goal Statement, Example Text, and Activity sections.\n4. Submit your hours through Bridge when finished.",
    nextSteps:
      "After submitting, wait for a director review. Approved hours appear on your Hours Summary within 3–5 days.",
    slotsTotal: 8,
    signUps: [
      {
        id: "s1",
        profileId: "p1",
        firstName: "Jordan",
        lastInitial: "L",
        spots: 1,
        email: "jordan.lee@example.com",
      },
      {
        id: "s2",
        profileId: "p2",
        firstName: "Amaiya",
        lastInitial: "O",
        spots: 2,
        email: "amaiya.okonkwo@example.com",
      },
    ],
  },
  {
    id: "a2",
    slug: "reading-buddy-sessions",
    title: "Reading Buddy Sessions",
    track: "Education",
    type: "Virtual",
    description:
      "Host two 30-minute reading sessions with assigned mentees. Materials and prompts provided.",
    location: "Zoom",
    hours: 1.5,
    deadline: "2026-08-22",
    instructions:
      "Confirm your time slot in the Education calendar, join with the Zoom link in your claim email, and log attendance after each session.",
    nextSteps:
      "Upload a brief reflection photo or screenshot when you request hours.",
    slotsTotal: 6,
    signUps: [
      {
        id: "s3",
        profileId: "p4",
        firstName: "Priya",
        lastInitial: "S",
        spots: 1,
        email: "priya.sharma@example.com",
      },
    ],
  },
  {
    id: "a3",
    slug: "givebutter-peer-outreach",
    title: "Givebutter Peer Outreach",
    track: "Fundraising",
    type: "Campaign",
    description:
      "Share your personal fundraising link with 10 peers and collect at least one confirmed share screenshot.",
    location: "Remote",
    hours: 1,
    deadline: "2026-08-30",
    instructions:
      "Use your fundraising link. Message friends with the provided template, then collect proof of outreach.",
    nextSteps:
      "Every $10 raised counts as 1 hour — submit via the Hours Request form as you go.",
    slotsTotal: 12,
    signUps: [
      {
        id: "s4",
        profileId: "p3",
        firstName: "Sam",
        lastInitial: "R",
        spots: 1,
        email: "sam.rivera@example.com",
      },
      {
        id: "s5",
        profileId: "p5",
        firstName: "Chris",
        lastInitial: "N",
        spots: 1,
        email: "chris.nguyen@example.com",
      },
    ],
  },
  {
    id: "a4",
    slug: "social-fundraiser-graphics",
    title: "Social Fundraiser Graphics",
    track: "Fundraising",
    type: "Design",
    description:
      "Design 3 Instagram story graphics promoting the fall fundraiser. Brand kit provided.",
    location: "Remote · Canva",
    hours: 3,
    deadline: "2026-08-10",
    instructions:
      "Duplicate the Canva brand kit, create 3 story-sized graphics, and export PNGs to the shared Drive folder.",
    nextSteps:
      "Tag @omelora in a draft caption suggestion when you submit hours.",
    slotsTotal: 4,
    signUps: [
      {
        id: "s6",
        profileId: "p1",
        firstName: "Jordan",
        lastInitial: "L",
        spots: 1,
        email: "jordan.lee@example.com",
      },
      {
        id: "s7",
        profileId: "p2",
        firstName: "Amaiya",
        lastInitial: "O",
        spots: 1,
        email: "amaiya.okonkwo@example.com",
      },
      {
        id: "s8",
        profileId: "p4",
        firstName: "Priya",
        lastInitial: "S",
        spots: 1,
        email: "priya.sharma@example.com",
      },
      {
        id: "s9",
        profileId: "p5",
        firstName: "Chris",
        lastInitial: "N",
        spots: 1,
        email: "chris.nguyen@example.com",
      },
    ],
  },
  {
    id: "a5",
    slug: "chapter-kickoff-facilitator",
    title: "Chapter Kickoff Facilitator",
    track: "Programs",
    type: "In-person",
    description:
      "Co-facilitate a 60-minute chapter kickoff workshop at a partner school.",
    location: "Los Angeles, CA",
    hours: 3,
    deadline: "2026-09-05",
    instructions:
      "Arrive 20 minutes early. Bring printed agendas from the Programs Drive folder. Follow the facilitator script.",
    nextSteps:
      "Debrief with your chapter advisor and submit hours with an event photo.",
    slotsTotal: 5,
    signUps: [
      {
        id: "s10",
        profileId: "p3",
        firstName: "Sam",
        lastInitial: "R",
        spots: 2,
        email: "sam.rivera@example.com",
      },
    ],
  },
  {
    id: "a6",
    slug: "mentorship-office-hours",
    title: "Mentorship Office Hours",
    track: "Programs",
    type: "Hybrid",
    description:
      "Staff a 90-minute office-hours block answering chapter questions on Discord voice.",
    location: "Discord · #programs",
    hours: 1.5,
    deadline: "2026-08-28",
    instructions:
      "Join the Programs voice channel at your reserved time. Log FAQs you couldn't answer for follow-up.",
    nextSteps: "Share your FAQ notes in the Programs channel thread.",
    slotsTotal: 3,
    signUps: [],
  },
  {
    id: "a7",
    slug: "school-supply-kit-packing",
    title: "School Supply Kit Packing",
    track: "Supplies",
    type: "In-person",
    description:
      "Pack 25 school supply kits for partner classrooms. Sorting lists provided on-site.",
    location: "Omelora Hub · Oakland",
    hours: 2,
    deadline: "2026-08-18",
    instructions:
      "Wear closed-toe shoes. Check in at the front desk. Follow the packing checklist at each station.",
    nextSteps: "Sign the volunteer log before leaving and request hours the same day.",
    slotsTotal: 10,
    signUps: [
      {
        id: "s11",
        profileId: "p2",
        firstName: "Amaiya",
        lastInitial: "O",
        spots: 1,
        email: "amaiya.okonkwo@example.com",
      },
      {
        id: "s12",
        profileId: "p1",
        firstName: "Jordan",
        lastInitial: "L",
        spots: 1,
        email: "jordan.lee@example.com",
      },
    ],
  },
  {
    id: "a8",
    slug: "inventory-photo-audit",
    title: "Inventory Photo Audit",
    track: "Supplies",
    type: "Remote",
    description:
      "Photograph and catalog remaining supply inventory from provided box lists.",
    location: "Remote",
    hours: 2,
    deadline: "2026-08-12",
    instructions:
      "Download the inventory spreadsheet, photograph each SKU on a plain background, and upload to Drive.",
    nextSteps: "Mark rows complete in the sheet and notify #supplies when done.",
    slotsTotal: 2,
    signUps: [
      {
        id: "s13",
        profileId: "p4",
        firstName: "Priya",
        lastInitial: "S",
        spots: 1,
        email: "priya.sharma@example.com",
      },
      {
        id: "s14",
        profileId: "p5",
        firstName: "Chris",
        lastInitial: "N",
        spots: 1,
        email: "chris.nguyen@example.com",
      },
    ],
  },
];
