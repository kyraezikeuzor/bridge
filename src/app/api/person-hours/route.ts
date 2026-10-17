import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonHours } from "@/lib/hoursCache";
import { requireAdminDirector } from "@/lib/directorAuth";

export const dynamic = "force-dynamic";

/** GET /api/person-hours?personId=... (defaults to session personId) */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const session = await auth();
    const sessionPersonId = session?.user?.personId || "";
    const queryPersonId = request.nextUrl.searchParams.get("personId") || "";
    if (queryPersonId && queryPersonId !== sessionPersonId && !await requireAdminDirector()) {
      return NextResponse.json({ error: "Director access required to view another member's hours" }, { status: 403 });
    }
    const personId = queryPersonId || sessionPersonId;

    if (!personId) {
      return NextResponse.json(
        { error: "Missing personId (sign in required)" },
        { status: 400 }
      );
    }

    const summary = await getPersonHours(personId);
    return NextResponse.json(summary, { headers: { "Server-Timing": `total;dur=${Date.now() - started}` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
