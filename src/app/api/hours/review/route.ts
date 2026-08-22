import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPersonById,
  updateHoursStatus,
  type HoursRequest,
  type ReviewUpdateMeta,
} from "@/lib/airtable";
import {
  getHoursRequests,
  patchHoursInCache,
  refreshHoursCache,
} from "@/lib/hoursCache";
import {
  sendHoursApprovedEmail,
  sendHoursRejectedEmail,
} from "@/lib/email";
import {
  isAssignedToReviewer,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";

export const dynamic = "force-dynamic";

const DEFAULT_REJECT_REASON =
  "After review, this submission could not be approved. Please check your proof and details, then resubmit if needed.";

type ActionBody = {
  action: "approve" | "reject";
  hoursId: string;
  /** Approve rating or reject reason label. */
  choice?: string;
  note?: string;
  /** Reviewer-set hours, overriding what the volunteer requested. */
  hours?: number;
  /** @deprecated use choice */
  reason?: string;
};

/** Accept only a sane, finite hours value; anything else leaves Hours untouched. */
function parseHoursOverride(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1000) {
    return undefined;
  }
  return Math.round(n * 100) / 100;
}

function bridgeHoursUrl() {
  const base =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://bridge.omelora.org";
  return `${base.replace(/\/$/, "")}/summary`;
}

/**
 * POST /api/hours/review
 * Background steps after optimistic UI update.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, hoursId } = body;
  if (!action || !hoursId) {
    return NextResponse.json(
      { error: "Missing action or hoursId" },
      { status: 400 }
    );
  }

  try {
    const reviewer = await resolveReviewerIdentity(session.user);
    const rows = await getHoursRequests("All");
    const row = rows.find(
      (candidate) =>
        candidate.id === hoursId &&
        isAssignedToReviewer(candidate.assigneeIds, reviewer)
    );
    if (!row) {
      return NextResponse.json(
        { error: "Hours request not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      await runApprove(row, {
        reviewRating: body.choice?.trim() || undefined,
        reviewNote: body.note?.trim() || undefined,
        reviewerId: reviewer.personId ?? undefined,
        hours: parseHoursOverride(body.hours),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      const rejectionReason =
        body.choice?.trim() || body.reason?.trim() || undefined;
      await runReject(row, {
        rejectionReason,
        reviewNote: body.note?.trim() || undefined,
        reviewerId: reviewer.personId ?? undefined,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[hours/review] handler error:", message);
    console.error(
      "[hours/review] handler error detail:",
      JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function resolveVolunteerEmail(row: HoursRequest): Promise<{
  email: string | null;
  firstName: string;
}> {
  const firstName = row.firstName || row.personName.split(" ")[0] || "";
  const personId = row.personIds[0];
  if (!personId) return { email: null, firstName };

  const person = await getPersonById(personId);
  return {
    email: person?.fields.Email?.trim() || null,
    firstName: person?.firstName || firstName,
  };
}

async function runApprove(row: HoursRequest, meta: ReviewUpdateMeta) {
  console.log("[hours/review] runApprove start", {
    hoursId: row.id,
    personIds: row.personIds,
  });

  await updateHoursStatus(row.id, "Approved", meta);
  patchHoursInCache(row.id, { status: "Approved" });
  console.log("[hours/review] Airtable status → Approved");

  const { email, firstName } = await resolveVolunteerEmail(row);
  console.log("[hours/review] resolved volunteer contact", {
    email: email || null,
    firstName,
  });

  if (email) {
    console.log("[hours/review] calling sendHoursApprovedEmail →", email);
    try {
      await sendHoursApprovedEmail(
        email,
        firstName,
        row.linkedActivity?.name || row.description || row.activityName,
        bridgeHoursUrl()
      );
    } catch (err) {
      console.error("[hours/review] sendHoursApprovedEmail FAILED:", err);
      throw err;
    }
  } else {
    console.error(
      "[hours/review] SKIP sendHoursApprovedEmail — no email for Linked Person",
      { hoursId: row.id, personIds: row.personIds }
    );
  }

  await refreshHoursCache();
}

async function runReject(row: HoursRequest, meta: ReviewUpdateMeta) {
  console.log("[hours/review] runReject start", {
    hoursId: row.id,
    personIds: row.personIds,
  });

  await updateHoursStatus(row.id, "Rejected", meta);
  patchHoursInCache(row.id, { status: "Rejected" });
  console.log("[hours/review] Airtable status → Rejected");

  const emailReason =
    [meta.rejectionReason, meta.reviewNote].filter(Boolean).join(" — ") ||
    DEFAULT_REJECT_REASON;

  const { email, firstName } = await resolveVolunteerEmail(row);
  console.log("[hours/review] resolved volunteer contact", {
    email: email || null,
    firstName,
    emailReason,
  });

  if (email) {
    console.log("[hours/review] calling sendHoursRejectedEmail →", email);
    try {
      await sendHoursRejectedEmail(
        email,
        firstName,
        row.linkedActivity?.name || row.description || row.activityName,
        emailReason,
        bridgeHoursUrl()
      );
    } catch (err) {
      console.error("[hours/review] sendHoursRejectedEmail FAILED:", err);
      throw err;
    }
  } else {
    console.error(
      "[hours/review] SKIP sendHoursRejectedEmail — no email for Linked Person",
      { hoursId: row.id, personIds: row.personIds }
    );
  }

  await refreshHoursCache();
}
