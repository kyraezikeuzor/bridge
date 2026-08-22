import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";

export const dynamic = "force-dynamic";

/** GET /api/person-activities?personId=... (defaults to session personId) */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionPersonId = session?.user?.personId || "";
    const queryPersonId = request.nextUrl.searchParams.get("personId") || "";
    const personId = queryPersonId || sessionPersonId;

    console.log("[api/person-activities] session.user:", session?.user);
    console.log("[api/person-activities] personId from session:", sessionPersonId);
    console.log("[api/person-activities] personId query param:", queryPersonId);
    console.log("[api/person-activities] personId used:", personId);

    if (!personId) {
      return NextResponse.json(
        { error: "Missing personId (sign in required)" },
        { status: 400 }
      );
    }

    const activities = await getPersonActivities(personId);
    return NextResponse.json({ activities, count: activities.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
