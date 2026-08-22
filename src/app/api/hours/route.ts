import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHoursRequests } from "@/lib/hoursCache";
import type { HoursStatus } from "@/lib/airtable";
import {
  isAssignedToReviewer,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";

export const dynamic = "force-dynamic";

/** GET /api/hours?status=Submitted|Approved|Rejected|All */
export async function GET(request: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.email && !user?.personId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status") || "All";
  const status =
    statusParam === "All" || statusParam === "all"
      ? "All"
      : (statusParam as HoursStatus);

  try {
    const reviewer = await resolveReviewerIdentity(user);
    const hours = (await getHoursRequests(status)).filter((row) =>
      isAssignedToReviewer(row.assigneeIds, reviewer)
    );
    return NextResponse.json({ hours, count: hours.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
