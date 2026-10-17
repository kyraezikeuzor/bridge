import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHoursRequests } from "@/lib/hoursCache";
import type { HoursStatus } from "@/lib/airtable";
import {
  canReviewHoursAssignment,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";
import { isLeaderRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** GET /api/hours?status=Submitted|Approved|Rejected|All */
export async function GET(request: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.email && !user?.personId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isLeaderRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const statusParam = request.nextUrl.searchParams.get("status") || "All";
  const status =
    statusParam === "All" || statusParam === "all"
      ? "All"
      : (statusParam as HoursStatus);

  try {
    const reviewer = await resolveReviewerIdentity(user);
    const hours = (await getHoursRequests(status)).filter((row) =>
      row.status !== "Draft" && canReviewHoursAssignment(row.assigneeIds, reviewer)
    );
    return NextResponse.json({ hours, count: hours.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[hours] Unable to load review queue:", message);
    return NextResponse.json({ error: "Unable to load hours requests" }, { status: 500 });
  }
}
