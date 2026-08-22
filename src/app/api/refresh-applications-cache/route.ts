import { NextResponse } from "next/server";
import {
  getApplicationsCacheStats,
  refreshApplicationsCache,
} from "@/lib/applicationsCache";

export const dynamic = "force-dynamic";

/** POST /api/refresh-applications-cache */
export async function POST() {
  try {
    const size = await refreshApplicationsCache();
    return NextResponse.json({
      ok: true,
      cached: size,
      ...getApplicationsCacheStats(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
