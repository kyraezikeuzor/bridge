import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";
import {
  createSubmission,
  createContribution,
  createSubmittedHoursFromContribution,
  finalizeContribution,
  fetchContributionsForClaim,
  fetchHoursForPerson,
  fetchSubmissionsForClaim,
  uploadSubmissionAttachment,
} from "@/lib/airtable";

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

    const [contributions, submissions] = await Promise.all([
      fetchContributionsForClaim(personId, claim),
      fetchSubmissionsForClaim(personId, claim),
    ]);
    return NextResponse.json({ claim, contributions, submissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/person-activities/:claimId — save an artifact or finalize a contribution. */
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
      const existing = await fetchSubmissionsForClaim(personId, claim);
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
      const submissions = await fetchSubmissionsForClaim(personId, claim);
      if (!submissions.length || (activity.submissionTarget && submissions.length !== activity.submissionTarget)) {
        const target = activity.submissionTarget;
        const error = target
          ? `Please submit all ${target} required submission${target === 1 ? "" : "s"} before requesting hours. You have saved ${submissions.length} of ${target}.`
          : "Save at least one submission before requesting hours.";
        return NextResponse.json({ error }, { status: 422 });
      }
      const existingContributions = await fetchContributionsForClaim(personId, claim);
      const existing = existingContributions.find(
        (item) => item.status === "Submitted" || item.status === "Approved"
      );
      if (existing?.status === "Approved") {
        return NextResponse.json({ contribution: existing });
      }

      let contribution = existing ?? await createContribution({
        personId,
        claim,
        notes: notes || null,
        submissionIds: submissions.map((item) => item.id),
        quantity: submissions.length,
        calculatedHours: activity.hoursValue,
      });

      // A failed response after creating Hours must remain retry-safe. The
      // contribution id is written into Activity Details, so we can reconnect
      // an interrupted finalization without creating a second credit record.
      let hoursRecordId = contribution.hoursRecordId;
      if (!hoursRecordId) {
        const previousHours = await fetchHoursForPerson(personId);
        const matchingHours = previousHours.find(
          (item) => item.description?.includes(`Bridge contribution ${contribution.id}`)
        );
        hoursRecordId = matchingHours?.id || null;
      }
      if (!hoursRecordId) {
        const hours = await createSubmittedHoursFromContribution({ contribution, activity, ownershipAgreement });
        hoursRecordId = hours.id;
      }
      contribution = await finalizeContribution(contribution.id, {
        submissionIds: submissions.map((item) => item.id),
        quantity: submissions.length,
        calculatedHours: activity.hoursValue,
        hoursRecordId,
      });
      return NextResponse.json({ contribution }, { status: 201 });
    }

    if (action !== "submit-oppia-certificate" || activity.platform !== "Oppia") {
      return NextResponse.json({ error: "This activity does not accept a completion action through Bridge" }, { status: 422 });
    }
    const certificateFile = uploadedFile instanceof File && uploadedFile.size > 0 ? uploadedFile : null;
    if (!certificateUrl && !certificateFile) return NextResponse.json({ error: "Upload your Oppia certificate or add its URL" }, { status: 400 });
    if (certificateFile && (certificateFile.type !== "application/pdf" || certificateFile.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ error: "Upload a PDF smaller than 10 MB" }, { status: 400 });
    }
    // Use the existing artifacts table for the uploaded certificate. The
    // finalized Contribution links that artifact as its review evidence.
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
    const contribution = await createContribution({
      personId,
      claim,
      workLink: certificateUrl || null,
      notes: notes || null,
      submissionIds,
      quantity: 1,
      calculatedHours: activity.hoursValue,
    });
    return NextResponse.json({ contribution }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
