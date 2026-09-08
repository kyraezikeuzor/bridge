import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  fetchAllActivities,
  fetchAllContributions,
  fetchAllPeople,
} from "@/lib/airtable";
import { isLeaderRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** Leader-only queue of completed Bridge work awaiting a decision. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isLeaderRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [contributions, people, activities] = await Promise.all([
      fetchAllContributions(),
      fetchAllPeople(),
      fetchAllActivities(),
    ]);
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
    const reviewContributions = contributions.map((contribution) => {
      const person = contribution.personId ? peopleById.get(contribution.personId) : null;
      const activity = contribution.activityId ? activitiesById.get(contribution.activityId) : null;
      return {
        ...contribution,
        personName: person
          ? [person.fields["First Name"], person.fields["Last Name"]].filter(Boolean).join(" ") || "Volunteer"
          : "Volunteer",
        activityName: activity?.name || "Activity",
        platform: activity?.platform || "Bridge",
        hoursValue: activity?.hoursValue ?? 0,
      };
    });
    return NextResponse.json({ contributions: reviewContributions, count: contributions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
