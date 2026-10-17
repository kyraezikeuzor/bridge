import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonActivities } from "@/lib/activitiesCache";
import { createWorkHours, coalesceHoursWork, hasFinalizedHoursWork } from "@/lib/airtable/hours-work";
import { asStringArray, getRecord, reserveRecord, updateRecord } from "@/lib/airtable/client";
import { fetchHoursRequestById, uploadHoursProof, type HoursFields } from "@/lib/airtable/hours";
import { type SubmissionFields } from "@/lib/airtable/submissions";
import { letterBatchError, MAX_PROOF_FILE_BYTES, MAX_PROOF_FILES, validBatchId, validCompletedDate } from "@/lib/activityCompletion";
import { refreshHoursCache } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

type CompletionBody = { batchId?: unknown; mode?: unknown; letters?: unknown; completedDate?: unknown; notes?: unknown; photoPermissions?: unknown; confirmation?: unknown };

export async function POST(request: Request, { params }: { params: { claimId: string } }) {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  const claim = (await getPersonActivities(personId)).find((item) => item.id === params.claimId);
  if (!claim?.activity || !claim.activityId) return NextResponse.json({ error: "Activity signup not found" }, { status: 404 });
  if (claim.status === "Cancelled") return NextResponse.json({ error: "This signup has been cancelled" }, { status: 409 });

  let body: CompletionBody;
  let files: File[] = [];
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries()) as CompletionBody;
      files = form.getAll("proof").filter((file): file is File => file instanceof File && file.size > 0);
    } else body = await request.json() as CompletionBody;
  } catch {
    return NextResponse.json({ error: "Could not read this form" }, { status: 400 });
  }
  if (!validBatchId(body.batchId) || !validCompletedDate(body.completedDate) || body.confirmation !== "true") {
    return NextResponse.json({ error: "Confirm your work and enter a valid completion date." }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 5000) return NextResponse.json({ error: "Notes must be under 5,000 characters." }, { status: 400 });
  const mode = claim.activity.completionWorkflow;
  if (body.mode !== mode) return NextResponse.json({ error: "Completion form does not match this activity." }, { status: 422 });
  let letters: string[] = [];
  if (mode === "Letters") {
    const error = letterBatchError(body.letters);
    if (error) return NextResponse.json({ error }, { status: 422 });
    letters = (body.letters as string[]).map((letter) => letter.trim());
  } else if (files.length > MAX_PROOF_FILES || files.some((file) => file.size > MAX_PROOF_FILE_BYTES || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type))) {
    return NextResponse.json({ error: "Add up to 10 JPG, PNG, WebP, or HEIC pictures, each under 10 MB." }, { status: 422 });
  }
  const activity = claim.activity;
  const batchId = body.batchId;
  const completedDate = body.completedDate;
  const reference = `BridgeBatch:${claim.id}:${batchId}`;
  try {
    const hours = await coalesceHoursWork(reference, async () => {
      const reservation = await reserveRecord("Hours", "Work Reference", reference);
      const existing = reservation.fields as HoursFields;
      if (asStringArray(existing["Linked Person"]).some((id) => id !== personId) || asStringArray(existing["Linked Activity"]).some((id) => id !== activity.id) ||
        (!claim.isLegacySignUp && asStringArray(existing["Linked Claim"]).some((id) => id !== claim.id))) {
        throw new Error("This batch belongs to another signup.");
      }
      if (hasFinalizedHoursWork(existing)) {
        const submitted = await fetchHoursRequestById(reservation.id);
        if (!submitted || !submitted.personIds.includes(personId) || !submitted.linkedActivityIds.includes(activity.id) ||
          (!claim.isLegacySignUp && submitted.claimId !== claim.id) || submitted.workReference !== reference) {
          throw new Error("This saved batch could not be matched to your signup. Please contact a coordinator.");
        }
        return submitted;
      }
      await updateRecord("Hours", reservation.id, { "Linked Person": [personId], "Linked Activity": [activity.id], ...(claim.isLegacySignUp ? {} : { "Linked Claim": [claim.id] }) });
      const submissionIds: string[] = [];
      if (mode === "Letters") {
        for (let index = 0; index < letters.length; index++) {
          const key = `${reference}:letter:${index + 1}`;
          const saved = await reserveRecord("Submissions", "Evidence Key", key);
          const fields = saved.fields as SubmissionFields;
          if (fields.Content && fields.Content.trim() !== letters[index]) throw new Error("A saved letter in this batch has changed. Start a new batch.");
          if (asStringArray(fields["Linked Person"]).some((id) => id !== personId)) throw new Error("Letter ownership mismatch.");
          if (!fields.Content) await updateRecord("Submissions", saved.id, {
            "Linked Person": [personId], "Linked Activity": [activity.id], ...(claim.isLegacySignUp ? {} : { "Linked Claim": [claim.id] }),
            "Evidence Key": key, Content: letters[index], Status: "Submitted", "Submitted Date": new Date().toISOString().slice(0, 10),
          });
          submissionIds.push(saved.id);
        }
      } else {
        for (let index = 0; index < files.length; index++) {
          const filename = `${batchId}-${index + 1}-${files[index].name}`;
          const current = await getRecord<HoursFields>("Hours", reservation.id);
          if (!current?.fields.Proof?.some((proof) => proof.filename === filename)) {
            await uploadHoursProof({ hoursId: reservation.id, file: files[index], filename });
          }
        }
        const current = await getRecord<HoursFields>("Hours", reservation.id);
        if (!current?.fields.Proof?.length) throw new Error("Add at least one proof picture before submitting.");
      }
      return createWorkHours({
        personId, claim, activity, reference, submissionIds,
        quantity: mode === "Letters" ? letters.length : undefined,
        requestedHours: mode === "Letters" ? letters.length / 3 : activity.hoursValue,
        workType: mode === "Letters" ? "Letter Writing" : "Photo Proof",
        completedDate, notes, photoPermissions: body.photoPermissions === "true",
      });
    });
    void refreshHoursCache().catch((error) => console.error("[complete] cache refresh failed", error));
    return NextResponse.json({ hours });
  } catch (error) {
    console.error("[complete] submission failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit this activity. Your draft is still available." }, { status: 503 });
  }
}
