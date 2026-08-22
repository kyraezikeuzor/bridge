import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonHours } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

/** GET /api/person-hours?personId=... (defaults to session personId) */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionPersonId = session?.user?.personId || "";
    const queryPersonId = request.nextUrl.searchParams.get("personId") || "";
    const personId = queryPersonId || sessionPersonId;

    console.log("[api/person-hours] session.user:", session?.user);
    console.log("[api/person-hours] personId from session:", sessionPersonId);
    console.log("[api/person-hours] personId query param:", queryPersonId);
    console.log("[api/person-hours] personId used:", personId);

    if (!personId) {
      return NextResponse.json(
        { error: "Missing personId (sign in required)" },
        { status: 400 }
      );
    }

    const summary = await getPersonHours(personId);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
