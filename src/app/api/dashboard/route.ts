import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchPersonWork, summarizePersonHours } from "@/lib/airtable";

export const dynamic = "force-dynamic";

/** GET /api/dashboard: the signed-in volunteer's hours summary and activities in one request. */
export async function GET() {
  const started = Date.now();
  const session = await auth();
  const personId = session?.user?.personId || "";
  if (!personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });

  try {
    const { claimed, hours } = await fetchPersonWork(personId);
    return NextResponse.json(
      { hoursSummary: summarizePersonHours(hours), activities: claimed },
      { headers: { "Server-Timing": `total;dur=${Date.now() - started}` } }
    );
  } catch (error) {
    console.error("[api/dashboard]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to load your dashboard" }, { status: 500 });
  }
}
