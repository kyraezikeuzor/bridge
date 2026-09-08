import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createHoursFromContribution,
  fetchAllActivities,
  fetchAllContributions,
  updateHoursStatus,
  updateContributionStatus,
} from "@/lib/airtable";
import { refreshHoursCache } from "@/lib/hoursCache";
import { isLeaderRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type ActionBody = { action: "approve" | "reject"; contributionId: string };

/** Approving a contribution awards the activity's configured Hours value once. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isLeaderRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.contributionId || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "Missing or invalid review action" }, { status: 400 });
  }

  try {
    const contribution = (await fetchAllContributions()).find(
      (candidate) => candidate.id === body.contributionId
    );
    if (!contribution) {
      return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
    }
    if (contribution.status !== "Submitted") {
      return NextResponse.json(
        { error: "This contribution has already been reviewed" },
        { status: 409 }
      );
    }

    if (body.action === "reject") {
      const reviewed = await updateContributionStatus(contribution.id, "Rejected");
      return NextResponse.json({ contribution: reviewed });
    }

    const activity = (await fetchAllActivities()).find(
      (candidate) => candidate.id === contribution.activityId
    );
    if (!activity) {
      return NextResponse.json({ error: "Contribution activity not found" }, { status: 422 });
    }
    // New viewer finalizations create a Submitted Hours record up front.
    // Retain the old creation path only for historical Contributions that do
    // not yet have that link.
    const hours = contribution.hoursRecordId
      ? await updateHoursStatus(contribution.hoursRecordId, "Approved", {
          reviewerId: session.user.personId || undefined,
          reviewNote: `Approved from Bridge contribution ${contribution.id}`,
        })
      : await createHoursFromContribution({
          contribution,
          activity,
          reviewerId: session.user.personId || undefined,
        });
    const reviewed = await updateContributionStatus(contribution.id, "Approved", {
      hoursRecordId: hours.id,
    });
    await refreshHoursCache();
    return NextResponse.json({ contribution: reviewed, hours });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[contributions/review] handler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
