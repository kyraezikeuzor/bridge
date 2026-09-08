import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPersonActivities } from "@/lib/activitiesCache";
import {
  createExternalContribution,
  createHoursFromContribution,
  fetchAllActivities,
  fetchAllContributions,
  getPersonByEmailDirect,
  linkContributionHoursRecord,
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
    console.error("[external contributions] MONSOON_WEBHOOK_SECRET is not configured");
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

  const eventId = asTrimmedString(payload.eventId, 256);
  const personEmail = asTrimmedString(payload.personEmail, 320);
  const projectId = asTrimmedString(payload.projectId, 256);
  const externalClaimId = asTrimmedString(payload.externalClaimId, 256);
  const workLink = asTrimmedString(payload.workLink, 2000);
  const notes = asTrimmedString(payload.notes, 5000);
  const completedAt = asTrimmedString(payload.completedAt, 100);
  const hours = typeof payload.hours === "number" ? payload.hours : null;
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

  const externalContributionId = `Monsoon:${eventId}`;
  try {
    const existing = (await fetchAllContributions()).find(
      (contribution) => contribution.externalContributionId === externalContributionId
    );

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
    const activityClaims = claims.filter((claim) => claim.activityId === activity.id);
    const claim = externalClaimId
      ? activityClaims.find((candidate) => candidate.externalClaimId === externalClaimId)
      : activityClaims.find((candidate) => !candidate.isLegacySignUp) || activityClaims[0];
    if (!claim) {
      return NextResponse.json(
        { error: "The person does not have a matching activity claim" },
        { status: 422 }
      );
    }

    if (existing) {
      if (existing.personId !== person.id || existing.activityId !== activity.id) {
        return NextResponse.json(
          { error: "eventId is already associated with another contribution" },
          { status: 409 }
        );
      }
      // A retry can safely finish the rare case where Airtable accepted the
      // contribution but the subsequent Hours write did not complete.
      if (!existing.hoursRecordId) {
        const awardedHours = await createHoursFromContribution({ contribution: existing, activity });
        const syncedContribution = await linkContributionHoursRecord(existing.id, awardedHours.id);
        await refreshHoursCache();
        return NextResponse.json({ contribution: syncedContribution, hours: awardedHours, duplicate: true });
      }
      return NextResponse.json({ contribution: existing, duplicate: true });
    }

    const contribution = await createExternalContribution({
      personId: person.id,
      claim,
      externalContributionId,
      workLink: workLink || null,
      notes: notes || null,
      verifiedHours: hours,
      submittedAt: completedAt || null,
    });
    const awardedHours = await createHoursFromContribution({ contribution, activity });
    const syncedContribution = await linkContributionHoursRecord(
      contribution.id,
      awardedHours.id
    );
    await refreshHoursCache();
    return NextResponse.json(
      { contribution: syncedContribution, hours: awardedHours },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[external contributions] handler error:", message);
    return NextResponse.json({ error: "Unable to sync external contribution" }, { status: 500 });
  }
}
