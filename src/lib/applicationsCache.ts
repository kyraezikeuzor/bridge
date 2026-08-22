import {
  fetchAllApplications,
  type Application,
  type ApplicationStatus,
} from "@/lib/airtable";

const CACHE_TTL_MS = 5 * 60 * 1000;

let applicationsCache: Application[] = [];
let lastRefreshedAt: number | null = null;
let refreshInFlight: Promise<number> | null = null;

export function getApplicationsCacheStats() {
  return {
    size: applicationsCache.length,
    lastRefreshedAt,
    ageMs: lastRefreshedAt === null ? null : Date.now() - lastRefreshedAt,
    isStale: isCacheStale(),
  };
}

function isCacheStale(): boolean {
  if (lastRefreshedAt === null || applicationsCache.length === 0) return true;
  return Date.now() - lastRefreshedAt > CACHE_TTL_MS;
}

export async function refreshApplicationsCache(): Promise<number> {
  if (refreshInFlight) {
    console.log("[applicationsCache] refresh already in flight — awaiting it");
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    console.log("[applicationsCache] refreshing Applications cache…");
    const started = Date.now();
    applicationsCache = await fetchAllApplications();
    lastRefreshedAt = Date.now();
    console.log(
      `[applicationsCache] refresh complete — cached ${applicationsCache.length} applications (${lastRefreshedAt - started}ms)`
    );
    return applicationsCache.length;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function ensureFresh() {
  if (isCacheStale()) {
    console.log("[applicationsCache] cache miss/stale — refreshing");
    await refreshApplicationsCache();
  } else {
    console.log("[applicationsCache] cache hit (no refresh needed)");
  }
}

/**
 * Fetch Applications, optionally filtered by Status.
 * Pass nothing / "All" for every status.
 */
export async function getApplications(
  status?: ApplicationStatus | "All" | null
): Promise<Application[]> {
  await ensureFresh();
  if (!status || status === "All") return [...applicationsCache];
  return applicationsCache.filter((app) => app.status === status);
}

/** Optimistically patch a cached application (e.g. after Approve/Reject). */
export function patchApplicationInCache(
  id: string,
  patch: Partial<Pick<Application, "status">>
) {
  applicationsCache = applicationsCache.map((app) =>
    app.id === id ? { ...app, ...patch, status: patch.status ?? app.status } : app
  );
}
