import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireAdminDirector } from "@/lib/directorAuth";
import { updateActivityStatus } from "@/lib/airtable";
import {
  getAllActivities,
  refreshActivitiesCache,
} from "@/lib/activitiesCache";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES = new Set(["Submitted", "Active", "Closed"]);

/** GET /api/activities — reviewable activities from Airtable. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activities = await getAllActivities();
    return NextResponse.json({ activities, count: activities.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/activities — update an activity's Airtable review status. */
export async function PATCH(request: NextRequest) {
  if (!await requireAdminDirector()) return NextResponse.json({ error: "Director access required" }, { status: 403 });

  let body: { activityId?: string; status?: string };
  try {
    body = (await request.json()) as { activityId?: string; status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const activityId = body.activityId?.trim();
  const status = body.status?.trim();
  if (!activityId || !status || !REVIEW_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "activityId and a valid status are required" },
      { status: 400 }
    );
  }

  try {
    const activity = await updateActivityStatus(
      activityId,
      status as "Submitted" | "Active" | "Closed"
    );
    await refreshActivitiesCache();
    return NextResponse.json({ activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
