import { NextResponse } from "next/server";
import { getHoursCacheStats, refreshHoursCache } from "@/lib/hoursCache";

export const dynamic = "force-dynamic";

/** POST /api/refresh-hours-cache */
export async function POST() {
  try {
    const size = await refreshHoursCache();
    return NextResponse.json({
      ok: true,
      cached: size,
      ...getHoursCacheStats(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
