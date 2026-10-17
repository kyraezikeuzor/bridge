import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ClaimError, claimActivity } from "@/lib/claimService";

export const dynamic = "force-dynamic";

/** POST: sign the signed-in volunteer up for an activity. Identity comes from the session only. */
export async function POST(_request: Request, { params }: { params: { activityId: string } }) {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const result = await claimActivity(personId, params.activityId);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ClaimError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[api/activities/claim]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't sign you up. Please try again." }, { status: 503 });
  }
}
