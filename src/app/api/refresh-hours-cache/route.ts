import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLeaderRole } from "@/lib/roles";
import { refreshHoursCache } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

/** POST /api/refresh-hours-cache: directors only, since a refresh reads from Airtable. */
export async function POST() {
  const session = await auth();
  if (!isLeaderRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await refreshHoursCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
