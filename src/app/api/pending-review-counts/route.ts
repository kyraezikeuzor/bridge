import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPendingReviewCounts } from "@/lib/pendingReview";

export const dynamic = "force-dynamic";

/** GET /api/pending-review-counts — counts for the signed-in director only. */
export async function GET() {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.email && !user?.personId) {
      return NextResponse.json(
        { error: "Missing signed-in user details" },
        { status: 401 }
      );
    }

    const counts = await getPendingReviewCounts(user);
    return NextResponse.json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
