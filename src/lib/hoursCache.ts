import {
  fetchAllHours,
  fetchHoursForPerson,
  summarizePersonHours,
  type HoursRequest,
  type HoursStatus,
  type PersonHoursSummary,
} from "@/lib/airtable";

const CACHE_TTL_MS = 5 * 60 * 1000;

let hoursCache: HoursRequest[] = [];
let lastRefreshedAt: number | null = null;
let refreshInFlight: Promise<number> | null = null;

export function getHoursCacheStats() {
  return {
    size: hoursCache.length,
    lastRefreshedAt,
    ageMs: lastRefreshedAt === null ? null : Date.now() - lastRefreshedAt,
    isStale: isCacheStale(),
  };
}

function isCacheStale(): boolean {
  if (lastRefreshedAt === null || hoursCache.length === 0) return true;
  return Date.now() - lastRefreshedAt > CACHE_TTL_MS;
}

export async function refreshHoursCache(): Promise<number> {
  if (refreshInFlight) {
    console.log("[hoursCache] refresh already in flight — awaiting it");
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    console.log("[hoursCache] refreshing Hours cache…");
    const started = Date.now();
    hoursCache = await fetchAllHours();
    lastRefreshedAt = Date.now();
    console.log(
      `[hoursCache] refresh complete — cached ${hoursCache.length} hours (${lastRefreshedAt - started}ms)`
    );
    return hoursCache.length;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function ensureFresh() {
  if (isCacheStale()) {
    console.log("[hoursCache] cache miss/stale — refreshing");
    await refreshHoursCache();
  } else {
    console.log("[hoursCache] cache hit (no refresh needed)");
  }
}

/** Fetch Hours requests, optionally filtered by Status. */
export async function getHoursRequests(
  status?: HoursStatus | "All" | null
): Promise<HoursRequest[]> {
  await ensureFresh();
  if (!status || status === "All") return [...hoursCache];
  return hoursCache.filter((row) => row.status === status);
}

/** Optimistically patch a cached hours row (e.g. after Approve/Reject). */
export function patchHoursInCache(
  id: string,
  patch: Partial<Pick<HoursRequest, "status">>
) {
  hoursCache = hoursCache.map((row) =>
    row.id === id ? { ...row, ...patch, status: patch.status ?? row.status } : row
  );
}

/**
 * Hours summary for a volunteer's dashboard (by People Airtable record id).
 * Matches Hours."Linked Person" linked-record IDs — not email.
 */
export async function getPersonHours(
  personId: string
): Promise<PersonHoursSummary> {
  console.log("[hoursCache] getPersonHours personId from session/API:", personId);

  const records = await fetchHoursForPerson(personId);

  // Keep cache in sync for any rows we already have
  if (records.length && hoursCache.length) {
    const byId = new Map(records.map((r) => [r.id, r]));
    hoursCache = hoursCache.map((row) => byId.get(row.id) ?? row);
  }

  console.log(
    `[hoursCache] getPersonHours("${personId}") → ${records.length} rows after linked-record resolve`
  );
  return summarizePersonHours(records);
}
