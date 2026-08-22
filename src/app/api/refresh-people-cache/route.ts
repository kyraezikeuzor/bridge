import { NextResponse } from "next/server";
import {
  getPeopleCacheStats,
  refreshPeopleCache,
} from "@/lib/peopleCache";

export const dynamic = "force-dynamic";

/**
 * Force-refresh the in-memory People cache from Airtable.
 * POST /api/refresh-people-cache
 */
export async function POST() {
  try {
    const size = await refreshPeopleCache();
    return NextResponse.json({
      ok: true,
      cached: size,
      ...getPeopleCacheStats(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
