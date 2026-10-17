import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPersonById,
  fetchHoursRequestById,
  serializeHoursReview,
  updateHoursStatus,
  type HoursRequest,
  type ReviewUpdateMeta,
} from "@/lib/airtable";
import {
  refreshHoursCache,
} from "@/lib/hoursCache";
import { emailLink } from "@/lib/links";
import {
  sendHoursApprovedEmail,
  sendHoursRejectedEmail,
} from "@/lib/email";
import {
  canReviewHoursAssignment,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";
import { isLeaderRole } from "@/lib/roles";
import { submissionValidationError } from "@/lib/workReview";

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
  // Was built from AUTH_URL/NEXTAUTH_URL, which is http://localhost:3000 in
  // development — so reviewing hours against a dev server emailed volunteers a
  // "View Update" button pointing at localhost. Emailed links never come from
  // auth config now; see lib/links.ts.
  return emailLink("/summary");
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
  if (!isLeaderRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.hoursId !== "string" || !body.hoursId.trim() || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json(
      { error: "Missing action or hoursId" },
      { status: 400 }
    );
  }
  const { action, hoursId } = body;
  if ([body.choice, body.note, body.reason].some((value) => value != null && (typeof value !== "string" || value.length > 5000))) {
    return NextResponse.json({ error: "Invalid review notes" }, { status: 400 });
  }

  return serializeHoursReview(hoursId, async () => {
    try {
      const reviewer = await resolveReviewerIdentity(session.user);
      const row = await fetchHoursRequestById(hoursId);
      if (!row || !canReviewHoursAssignment(row.assigneeIds, reviewer)) {
        return NextResponse.json(
          { error: "Hours request not found" },
          { status: 404 }
        );
      }
      if (row.status !== "Submitted") {
        return NextResponse.json({ error: "This request has already been reviewed or is not ready for review" }, { status: 409 });
      }

      if (action === "approve") {
        if (row.workType === "Letter Writing") {
          const count = row.submissions.length;
          if (count < 3 || count % 3 !== 0 || count !== row.quantity || row.submissions.some((letter) => !letter.content?.trim())) {
            return NextResponse.json({ error: "A letter batch must contain complete groups of three typed letters." }, { status: 422 });
          }
          if (row.requestedHours !== count / 3) return NextResponse.json({ error: "Letter hours do not match the submitted letter count." }, { status: 422 });
        }
        if (row.workType === "Photo Proof" && !row.proofFiles.length) {
          return NextResponse.json({ error: "Proof pictures are required for this activity." }, { status: 422 });
        }
        if (row.workReference?.startsWith("Bridge:") && row.linkedActivity?.type === "Submission" && row.linkedActivity.platform === "Bridge") {
          const evidenceError = submissionValidationError(row.linkedActivity.submissionTarget ?? null, row.linkedActivity.submissionFormat ?? null, row.submissions);
          if (!row.ownershipAgreement || evidenceError) return NextResponse.json({ error: evidenceError || "The ownership agreement is required" }, { status: 422 });
        }
        if (row.workReference?.startsWith("Bridge:") && row.platform === "Oppia" && !row.proofUrl && !row.submissions.some((submission) => submission.files.length)) {
          return NextResponse.json({ error: "Certificate evidence is required" }, { status: 422 });
        }
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
      return NextResponse.json({ error: "Unable to review this hours request" }, { status: 500 });
    }
  });
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

async function refreshAfterReview() {
  try {
    await refreshHoursCache();
  } catch (error) {
    // The Hours update is already durable. Let a later read retry this refresh.
    console.error("[hours/review] Post-review cache refresh failed:", error);
  }
}

async function runApprove(row: HoursRequest, meta: ReviewUpdateMeta) {
  await updateHoursStatus(row.id, "Approved", meta);

  try {
    const { email, firstName } = await resolveVolunteerEmail(row);
    if (email) {
      await sendHoursApprovedEmail(
        email,
        firstName,
        row.linkedActivity?.name || row.description || row.activityName,
        bridgeHoursUrl()
      );
    }
  } catch (error) {
    // Contact lookup/delivery cannot undo an already-saved review.
    console.error("[hours/review] Approval notification failed:", error);
  }
  await refreshAfterReview();
}

async function runReject(row: HoursRequest, meta: ReviewUpdateMeta) {
  await updateHoursStatus(row.id, "Rejected", meta);

  const emailReason =
    [meta.rejectionReason, meta.reviewNote].filter(Boolean).join(" — ") ||
    DEFAULT_REJECT_REASON;
  try {
    const { email, firstName } = await resolveVolunteerEmail(row);
    if (email) {
      await sendHoursRejectedEmail(
        email,
        firstName,
        row.linkedActivity?.name || row.description || row.activityName,
        emailReason,
        bridgeHoursUrl()
      );
    }
  } catch (error) {
    console.error("[hours/review] Rejection notification failed:", error);
  }
  await refreshAfterReview();
}
