import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";

export const dynamic = "force-dynamic";

/** GET /api/person-activities — always scoped to the signed-in person. */
export async function GET() {
  try {
    const session = await auth();
    const personId = session?.user?.personId || "";

    if (!personId) {
      return NextResponse.json(
        { error: "Sign in is required" },
        { status: 401 }
      );
    }

    const activities = await getPersonActivities(personId);
    return NextResponse.json({ activities, count: activities.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
