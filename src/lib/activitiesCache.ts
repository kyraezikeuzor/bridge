import {
  fetchAllActivities,
  fetchClaimedActivitiesForPerson,
  type Activity,
  type ClaimedActivity,
} from "@/lib/airtable";

const CACHE_TTL_MS = 5 * 60 * 1000;

let activitiesCache: Activity[] = [];
let lastRefreshedAt: number | null = null;
let refreshInFlight: Promise<number> | null = null;

export function getActivitiesCacheStats() {
  return {
    size: activitiesCache.length,
    lastRefreshedAt,
    ageMs: lastRefreshedAt === null ? null : Date.now() - lastRefreshedAt,
    isStale: isCacheStale(),
  };
}

function isCacheStale(): boolean {
  if (lastRefreshedAt === null || activitiesCache.length === 0) return true;
  return Date.now() - lastRefreshedAt > CACHE_TTL_MS;
}

export async function refreshActivitiesCache(): Promise<number> {
  if (refreshInFlight) {
    console.log("[activitiesCache] refresh already in flight — awaiting it");
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    console.log("[activitiesCache] refreshing Activities cache…");
    const started = Date.now();
    activitiesCache = await fetchAllActivities();
    lastRefreshedAt = Date.now();
    console.log(
      `[activitiesCache] refresh complete — cached ${activitiesCache.length} activities (${lastRefreshedAt - started}ms)`
    );
    return activitiesCache.length;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function ensureFresh() {
  if (isCacheStale()) {
    console.log("[activitiesCache] cache miss/stale — refreshing");
    await refreshActivitiesCache();
  } else {
    console.log("[activitiesCache] cache hit (no refresh needed)");
  }
}

/**
 * Activities the person has signed up for.
 * Matches Activities."Linked Sign Ups" → People Airtable record IDs — not email.
 */
export async function getPersonActivities(
  personId: string
): Promise<ClaimedActivity[]> {
  console.log(
    "[activitiesCache] getPersonActivities personId from session/API:",
    personId
  );

  const claimed = await fetchClaimedActivitiesForPerson(personId);

  console.log(
    `[activitiesCache] getPersonActivities("${personId}") → ${claimed.length} activities after linked-record resolve`
  );
  return claimed;
}

export async function getAllActivities(): Promise<Activity[]> {
  await ensureFresh();
  return [...activitiesCache];
}
