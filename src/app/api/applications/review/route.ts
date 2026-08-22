import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createPeopleHistoryForApplication,
  updateApplicationOnboardingDetails,
  updateApplicationStatus,
  type Application,
  type ReviewUpdateMeta,
} from "@/lib/airtable";
// The cached row is patched in place after a decision; the full-table refresh
// is left to the explicit Refresh button rather than run on every review.
import {
  getApplications,
  patchApplicationInCache,
} from "@/lib/applicationsCache";
import { findOrCreatePersonByEmail } from "@/lib/peopleCache";
import {
  isAssignedToReviewer,
  resolveReviewerIdentity,
} from "@/lib/reviewAssignee";
import {
  sendCommentReplyEmail,
  sendVolunteerAcceptanceEmail,
  sendVolunteerRejectionEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

type ActionBody = {
  action: "approve" | "reject" | "reply";
  applicationId: string;
  replyText?: string;
  /** Approve rating or reject reason label. */
  choice?: string;
  note?: string;
  /**
   * Split a decision into two requests so the UI can confirm as soon as the
   * Airtable status lands, without waiting on mail + CRM writes:
   *   "status"   — set Status/Reviewer/Review Notes, then return.
   *   "followup" — send the email and create the Person/History records.
   * Omitted runs both in one request (unchanged behaviour for other callers).
   */
  phase?: "status" | "followup";
};

/**
 * POST /api/applications/review
 * Background (non-optimistic) steps after the UI already updated.
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

  const { action, applicationId } = body;
  if (!action || !applicationId) {
    return NextResponse.json(
      { error: "Missing action or applicationId" },
      { status: 400 }
    );
  }

  try {
    const reviewer = await resolveReviewerIdentity(session.user);
    const apps = await getApplications("All");
    const app = apps.find(
      (candidate) =>
        candidate.id === applicationId &&
        isAssignedToReviewer(candidate.assigneeIds, reviewer)
    );
    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (action === "reply") {
      const replyText = body.replyText?.trim();
      if (!replyText) {
        return NextResponse.json(
          { error: "Missing replyText" },
          { status: 400 }
        );
      }
      if (!app.email || !app.comments) {
        return NextResponse.json(
          { error: "Application has no email or comments to reply to" },
          { status: 400 }
        );
      }
      await sendCommentReplyEmail(
        app.email,
        app.firstName,
        app.comments,
        replyText
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "approve" || action === "reject") {
      const approving = action === "approve";
      const meta: ReviewUpdateMeta = {
        reviewRating: approving ? body.choice?.trim() || undefined : undefined,
        rejectionReason: approving ? undefined : body.choice?.trim() || undefined,
        reviewNote: body.note?.trim() || undefined,
        reviewerId: reviewer.personId ?? undefined,
      };

      if (body.phase !== "followup") {
        await writeDecisionStatus(app, approving ? "Accepted" : "Rejected", meta);
        if (body.phase === "status") return NextResponse.json({ ok: true });
      }

      const replyText = body.replyText?.trim() || undefined;
      if (approving) await runApproveFollowup(app, replyText);
      else await runRejectFollowup(app, replyText);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[applications/review] handler error:", message);
    console.error(
      "[applications/review] handler error detail:",
      JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Phase 1 — the decision itself. Kept deliberately small so the reviewer's
 * confirmation toast isn't held up behind mail and CRM writes.
 */
async function writeDecisionStatus(
  app: Application,
  status: "Accepted" | "Rejected",
  meta: ReviewUpdateMeta
) {
  console.log("[applications/review] writing status", {
    applicationId: app.id,
    status,
    email: app.email || null,
  });

  await updateApplicationStatus(app.id, status, meta);
  patchApplicationInCache(app.id, { status });
  console.log(`[applications/review] Airtable status → ${status}`);
}

/** Record a background failure where only the dev team will see it. */
async function noteOnboardingFailure(app: Application, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  try {
    const existing = app.fields["Onboarding Details"]?.trim();
    const note = `[${new Date().toISOString()}] ${message}`;
    await updateApplicationOnboardingDetails(
      app.id,
      existing ? `${existing}\n${note}` : note
    );
  } catch (writeErr) {
    console.error(
      "[applications/review] failed to record onboarding-details note:",
      writeErr
    );
  }
}

/**
 * Reply to the applicant's comment, when the reviewer wrote one alongside their
 * decision. Sent as its own email after the decision email.
 */
async function sendReplyIfProvided(app: Application, replyText?: string) {
  if (!replyText) return;

  if (!app.email || !app.comments) {
    console.warn(
      "[applications/review] comment reply skipped — application has no email or comments",
      { applicationId: app.id }
    );
    return;
  }

  try {
    await sendCommentReplyEmail(
      app.email,
      app.firstName,
      app.comments,
      replyText
    );
    console.log("[applications/review] comment reply sent →", app.email);
  } catch (err) {
    console.error("[applications/review] sendCommentReplyEmail FAILED:", err);
    await noteOnboardingFailure(app, `Comment reply email failed: ${err}`);
  }
}

/**
 * Phase 2 — acceptance email, optional comment reply, then Person/History. Runs
 * after the status is already committed, so nothing here rethrows: a failure is
 * logged and written to the application's Onboarding Details rather than
 * surfaced to the reviewer.
 */
async function runApproveFollowup(app: Application, replyText?: string) {
  if (app.email) {
    console.log(
      "[applications/review] calling sendVolunteerAcceptanceEmail →",
      app.email
    );
    try {
      await sendVolunteerAcceptanceEmail(
        app.email,
        app.firstName,
        app.track || app.tracks.join(", ")
      );
    } catch (err) {
      console.error(
        "[applications/review] sendVolunteerAcceptanceEmail FAILED:",
        err
      );
      await noteOnboardingFailure(app, `Acceptance email failed: ${err}`);
    }
  } else {
    console.error(
      "[applications/review] SKIP sendVolunteerAcceptanceEmail — application has no email",
      { applicationId: app.id }
    );
  }

  await sendReplyIfProvided(app, replyText);

  try {
    const person = await findOrCreatePersonByEmail(app);
    await createPeopleHistoryForApplication({
      personId: person?.id,
      applicationId: app.id,
      role: app.role || "Volunteer",
      tracks: app.tracks,
      school: app.school,
      state: app.state,
      country: app.country,
    });
    console.log(
      "[applications/review] People History created — person:",
      person?.id ?? "none (no email on application)"
    );
  } catch (err) {
    console.error(
      "[applications/review] Person/History after approve failed (email already attempted):",
      err
    );
    await noteOnboardingFailure(app, `History/Person sync failed: ${err}`);
  }
}

/**
 * Phase 2 for a rejection — the update email plus any comment reply. No
 * Person/History records are created for a rejected application.
 */
async function runRejectFollowup(app: Application, replyText?: string) {
  if (!app.email) {
    console.error(
      "[applications/review] SKIP sendVolunteerRejectionEmail — application has no email",
      { applicationId: app.id }
    );
    return;
  }

  console.log(
    "[applications/review] calling sendVolunteerRejectionEmail →",
    app.email
  );
  try {
    await sendVolunteerRejectionEmail(app.email, app.firstName);
  } catch (err) {
    console.error(
      "[applications/review] sendVolunteerRejectionEmail FAILED:",
      err
    );
    await noteOnboardingFailure(app, `Rejection email failed: ${err}`);
  }

  await sendReplyIfProvided(app, replyText);
}
