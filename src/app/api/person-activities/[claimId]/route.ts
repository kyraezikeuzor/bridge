import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";
import {
  createSubmission,
  createWorkHours,
  coalesceHoursWork,
  fetchHoursForClaim,
  fetchWorkingSubmissionsForClaim,
  uploadSubmissionAttachment,
} from "@/lib/airtable";
import { nextWorkReference, submissionValidationError } from "@/lib/workReview";
import { refreshHoursCache } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

/** GET /api/person-activities/:claimId — scoped to the signed-in person. */
export async function GET(
  _request: Request,
  { params }: { params: { claimId: string } }
) {
  try {
    const session = await auth();
    const personId = session?.user?.personId || "";

    if (!personId) {
      return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
    }

    const claimId = params.claimId.trim();
    if (!claimId) {
      return NextResponse.json({ error: "Activity claim not found" }, { status: 404 });
    }

    const claim = (await getPersonActivities(personId)).find(
      (activity) => activity.id === claimId
    );
    if (!claim) {
      // Do not reveal whether another volunteer owns the requested claim.
      return NextResponse.json({ error: "Activity claim not found" }, { status: 404 });
    }

    const hours = await fetchHoursForClaim(personId, claim);
    return NextResponse.json({ claim, hours });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[person-activities/claim] GET handler error:", message);
    return NextResponse.json({ error: "Unable to load this activity" }, { status: 500 });
  }
}

/** POST /api/person-activities/:claimId — save an artifact or finalize work into Hours. */
export async function POST(
  request: Request,
  { params }: { params: { claimId: string } }
) {
  try {
    const session = await auth();
    const personId = session?.user?.personId || "";
    if (!personId) {
      return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
    }

    const claim = (await getPersonActivities(personId)).find(
      (activity) => activity.id === params.claimId.trim()
    );
    if (!claim) {
      return NextResponse.json({ error: "Activity claim not found" }, { status: 404 });
    }

    const activity = claim.activity;
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (claim.status === "Cancelled") return NextResponse.json({ error: "This signup has been cancelled" }, { status: 409 });
    if (activity.completionWorkflow) {
      return NextResponse.json({ error: "Use the current activity completion form to submit work." }, { status: 410 });
    }

    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const body = (form ? Object.fromEntries(form.entries()) : await request.json()) as {
      action?: unknown;
      content?: unknown;
      certificateUrl?: unknown;
      notes?: unknown;
      ownershipAgreement?: unknown;
    };
    const action = typeof body.action === "string" ? body.action : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const uploadedFile = form?.get("file");
    const certificateUrl = typeof body.certificateUrl === "string" ? body.certificateUrl.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const ownershipAgreement = body.ownershipAgreement === "true";
    if (content.length > 15000 || certificateUrl.length > 2000 || notes.length > 5000) {
      return NextResponse.json({ error: "Your submission is too long" }, { status: 400 });
    }
    for (const urlValue of [certificateUrl]) {
      if (!urlValue) continue;
      try {
        const url = new URL(urlValue);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      } catch {
        return NextResponse.json({ error: "Use a valid http(s) URL" }, { status: 400 });
      }
    }

    if (action === "save-submission") {
      if (activity.type !== "Submission" || activity.platform !== "Bridge") {
        return NextResponse.json({ error: "This activity does not accept Bridge submissions" }, { status: 422 });
      }
      const submittedHours = await fetchHoursForClaim(personId, claim);
      if (submittedHours.some((row) => row.status === "Submitted" || row.status === "Approved")) {
        return NextResponse.json({ error: "Your work is already submitted; saved evidence cannot be changed while it is reviewed" }, { status: 409 });
      }
      const isPdf = uploadedFile instanceof File && uploadedFile.size > 0;
      if (isPdf && (uploadedFile.type !== "application/pdf" || uploadedFile.size > 10 * 1024 * 1024)) return NextResponse.json({ error: "Upload a PDF smaller than 10 MB" }, { status: 400 });
      const submissionFormat = activity.submissionFormat;
      if (submissionFormat === "Text" && (!content || isPdf)) {
        return NextResponse.json({ error: "This activity requires a text submission" }, { status: 400 });
      }
      if (submissionFormat === "File" && (content || !isPdf)) {
        return NextResponse.json({ error: "This activity requires a PDF submission" }, { status: 400 });
      }
      if (!submissionFormat) {
        return NextResponse.json({ error: "This activity needs a submission format before work can be added" }, { status: 422 });
      }
      const existing = await fetchWorkingSubmissionsForClaim(personId, claim, submittedHours);
      if (activity.submissionTarget && existing.length >= activity.submissionTarget) {
        return NextResponse.json({ error: "The submission target has already been reached" }, { status: 409 });
      }
      const submission = await createSubmission({ personId, claim, content: content || null });
      if (isPdf) {
        const file = uploadedFile as File;
        const attachment = await uploadSubmissionAttachment({ submissionId: submission.id, filename: file.name, contentType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
        submission.files = [attachment];
      }
      return NextResponse.json({ submission }, { status: 201 });
    }

    if (action === "finalize-submissions") {
      if (activity.type !== "Submission" || activity.platform !== "Bridge") {
        return NextResponse.json({ error: "This activity cannot be finalized with submissions" }, { status: 422 });
      }
      if (!ownershipAgreement) {
        return NextResponse.json({ error: "You must agree to the ownership agreement before submitting." }, { status: 422 });
      }
      const submissions = await fetchWorkingSubmissionsForClaim(personId, claim);
      const error = submissionValidationError(activity.submissionTarget, activity.submissionFormat, submissions);
      if (error) {
        return NextResponse.json({ error }, { status: 422 });
      }
      const hours = await coalesceHoursWork(`claim:${claim.id}`, async () => {
        const previous = await fetchHoursForClaim(personId, claim);
        const existing = previous.find((row) => row.status === "Approved") || previous.find((row) => row.status === "Submitted");
        if (existing) return existing;
        return createWorkHours({
          personId, claim, activity,
          reference: nextWorkReference(claim.id, previous),
          submissionIds: submissions.map((item) => item.id),
          quantity: submissions.length,
          notes, ownershipAgreement,
          startedAt: submissions[0]?.submittedDate || undefined,
        });
      });
      await refreshHoursCache();
      return NextResponse.json({ hours });
    }

    if (action !== "submit-oppia-certificate" || activity.platform !== "Oppia") {
      return NextResponse.json({ error: "This activity does not accept a completion action through Bridge" }, { status: 422 });
    }
    const certificateFile = uploadedFile instanceof File && uploadedFile.size > 0 ? uploadedFile : null;
    if (!certificateUrl && !certificateFile) return NextResponse.json({ error: "Upload your Oppia certificate or add its URL" }, { status: 400 });
    if (certificateFile && (certificateFile.type !== "application/pdf" || certificateFile.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ error: "Upload a PDF smaller than 10 MB" }, { status: 400 });
    }
    const hours = await coalesceHoursWork(`claim:${claim.id}`, async () => {
      const previous = await fetchHoursForClaim(personId, claim);
      const existing = previous.find((row) => row.status === "Approved") || previous.find((row) => row.status === "Submitted");
      if (existing) return existing;
      let submissionIds: string[] | undefined;
      if (certificateFile) {
        const evidence = await createSubmission({ personId, claim });
        await uploadSubmissionAttachment({
          submissionId: evidence.id,
          filename: certificateFile.name,
          contentType: certificateFile.type,
          base64: Buffer.from(await certificateFile.arrayBuffer()).toString("base64"),
        });
        submissionIds = [evidence.id];
      }
      return createWorkHours({
        personId, claim, activity,
        reference: nextWorkReference(claim.id, previous),
        proofLink: certificateUrl || undefined,
        notes, submissionIds, quantity: 1,
      });
    });
    await refreshHoursCache();
    return NextResponse.json({ hours });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[person-activities/claim] POST handler error:", message);
    return NextResponse.json({ error: "Unable to save your work" }, { status: 500 });
  }
}
