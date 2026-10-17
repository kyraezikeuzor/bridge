import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersonActivities } from "@/lib/activitiesCache";
import {
  createWorkHours,
  coalesceHoursWork,
  findHoursByWorkReference,
  fetchAllActivities,
  findHoursByExternalReference,
  getPersonByEmailDirect,
} from "@/lib/airtable";
import { refreshHoursCache } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

const MAX_EVENT_AGE_MS = 5 * 60 * 1000;

type ExternalContributionPayload = {
  eventId?: unknown;
  personEmail?: unknown;
  projectId?: unknown;
  externalClaimId?: unknown;
  workLink?: unknown;
  notes?: unknown;
  hours?: unknown;
  completedAt?: unknown;
};

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validSignature(signature: string, expected: string): boolean {
  const actualBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

/**
 * Receives a Monsoon completion event. This endpoint intentionally uses no
 * browser session: authenticity comes from an HMAC over the untouched body and
 * a short-lived timestamp, so the external service can call it directly.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MONSOON_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[external hours] MONSOON_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "External sync is unavailable" }, { status: 503 });
  }

  const timestamp = request.headers.get("x-bridge-timestamp");
  const signature =
    request.headers.get("x-bridge-signature") ||
    request.headers.get("x-monsoon-signature");
  const timestampSeconds = timestamp && /^\d{10}$/.test(timestamp) ? Number(timestamp) : NaN;
  if (!signature || !Number.isFinite(timestampSeconds)) {
    return NextResponse.json({ error: "Missing or invalid signature headers" }, { status: 401 });
  }
  if (Math.abs(Date.now() - timestampSeconds * 1000) > MAX_EVENT_AGE_MS) {
    return NextResponse.json({ error: "Expired external sync signature" }, { status: 401 });
  }

  const rawBody = await request.text();
  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
  if (!validSignature(signature, expectedSignature)) {
    return NextResponse.json({ error: "Invalid external sync signature" }, { status: 401 });
  }

  let payload: ExternalContributionPayload;
  try {
    payload = JSON.parse(rawBody) as ExternalContributionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Payload must be an object" }, { status: 400 });
  }

  const eventId = asTrimmedString(payload.eventId, 256);
  const personEmail = asTrimmedString(payload.personEmail, 320);
  const projectId = asTrimmedString(payload.projectId, 256);
  const externalClaimId = asTrimmedString(payload.externalClaimId, 256);
  const workLink = asTrimmedString(payload.workLink, 2000);
  const notes = asTrimmedString(payload.notes, 5000);
  const completedAt = asTrimmedString(payload.completedAt, 100);
  const hours = typeof payload.hours === "number" ? payload.hours : null;
  if (payload.hours != null && typeof payload.hours !== "number") {
    return NextResponse.json({ error: "hours must be a number" }, { status: 400 });
  }
  if (!eventId || !personEmail || !projectId) {
    return NextResponse.json(
      { error: "eventId, personEmail, and projectId are required" },
      { status: 400 }
    );
  }
  if (workLink && !isValidHttpUrl(workLink)) {
    return NextResponse.json({ error: "workLink must be a valid http(s) URL" }, { status: 400 });
  }
  if (typeof payload.workLink === "string" && !workLink) {
    return NextResponse.json({ error: "workLink is too long or empty" }, { status: 400 });
  }
  if (typeof payload.notes === "string" && !notes) {
    return NextResponse.json({ error: "notes is too long or empty" }, { status: 400 });
  }
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 1000)) {
    return NextResponse.json({ error: "hours must be a positive number up to 1000" }, { status: 400 });
  }
  if (completedAt && Number.isNaN(new Date(completedAt).getTime())) {
    return NextResponse.json({ error: "completedAt must be an ISO date" }, { status: 400 });
  }
  if (payload.completedAt != null && !completedAt) {
    return NextResponse.json({ error: "completedAt must be a valid date string" }, { status: 400 });
  }

  const externalReference = `Monsoon:${eventId}`;
  try {
    const [person, activities] = await Promise.all([
      getPersonByEmailDirect(personEmail),
      fetchAllActivities(),
    ]);
    if (!person) {
      return NextResponse.json({ error: "No Bridge person matches personEmail" }, { status: 422 });
    }
    const matchingActivities = activities.filter(
      (activity) =>
        activity.platform === "Monsoon" &&
        activity.externalProjectId === projectId
    );
    if (matchingActivities.length !== 1) {
      return NextResponse.json(
        { error: "projectId must match exactly one Monsoon external-sync activity" },
        { status: 422 }
      );
    }
    const activity = matchingActivities[0];
    const claims = await getPersonActivities(person.id);
    const activityClaims = claims.filter((claim) => claim.activityId === activity.id && claim.status !== "Cancelled");
    const claim = externalClaimId
      ? activityClaims.find((candidate) => candidate.externalClaimId === externalClaimId)
      : activityClaims.find((candidate) => !candidate.isLegacySignUp) || activityClaims[0];
    if (!claim) {
      return NextResponse.json(
        { error: "The person does not have a matching activity claim" },
        { status: 422 }
      );
    }

    const hoursRecord = await coalesceHoursWork(externalReference, async () => {
      const existing = await findHoursByWorkReference(externalReference) || await findHoursByExternalReference(externalReference);
      if (existing && (!existing.personIds.includes(person.id) || !existing.linkedActivityIds.includes(activity.id))) {
        throw new Error("eventId is already associated with another person or activity");
      }
      if (existing && existing.status !== "Draft") return existing;
      return createWorkHours({
        personId: person.id, claim, activity,
        reference: externalReference, externalReference,
        proofLink: workLink || undefined, notes: notes || undefined,
        verifiedHours: hours, approved: true,
        completedAt: completedAt ? new Date(completedAt).toISOString() : undefined,
      });
    });
    await refreshHoursCache();
    return NextResponse.json({ hours: hoursRecord });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[external hours] handler error:", message);
    return NextResponse.json({ error: "Unable to sync external work and hours" }, { status: 500 });
  }
}
