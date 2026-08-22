import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getApplications } from "@/lib/applicationsCache";
import type { ApplicationStatus } from "@/lib/airtable";
import {
  isAssignedToReviewer,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";

export const dynamic = "force-dynamic";

/** GET /api/applications?status=Submitted|Accepted|Rejected|All */
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
      : (statusParam as ApplicationStatus);

  try {
    const reviewer = await resolveReviewerIdentity(user);
    const applications = (await getApplications(status)).filter((application) =>
      isAssignedToReviewer(application.assigneeIds, reviewer)
    );
    return NextResponse.json({ applications, count: applications.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
