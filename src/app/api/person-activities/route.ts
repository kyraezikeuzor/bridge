import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";

export const dynamic = "force-dynamic";

/** GET /api/person-activities — always scoped to the signed-in person. */
export async function GET() {
  const started = Date.now();
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
    return NextResponse.json(
      { activities, count: activities.length },
      { headers: { "Server-Timing": `total;dur=${Date.now() - started}` } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[person-activities] handler error:", message);
    return NextResponse.json({ error: "Unable to load your activities" }, { status: 500 });
  }
}
