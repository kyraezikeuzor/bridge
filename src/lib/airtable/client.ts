import { revalidateTag, unstable_cache } from "next/cache";

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

export type AirtableAttachment = {
  id?: string;
  url: string;
  filename: string;
};

export type AirtableRecord<TFields> = {
  id: string;
  createdTime: string;
  fields: TFields;
};

type AirtableListResponse<TFields> = {
  records: AirtableRecord<TFields>[];
  offset?: string;
};

const LOG_TIMING = process.env.AIRTABLE_TIMING === "1" || process.env.NODE_ENV !== "production";

/** One line per Airtable call, so slow pages can be traced to tables. */
function logTiming(label: string, started: number) {
  if (LOG_TIMING) console.log(`[airtable] ${label} ${Date.now() - started}ms`);
}

/** How long a cached table may be served before Airtable is asked again. */
const TABLE_CACHE_SECONDS = 60;

function tableTag(table: string) {
  return `airtable:${table}`;
}

/**
 * A whole table (or one filtered slice of it) from Vercel's shared data cache.
 * The cache survives server restarts, expires after a minute so edits made
 * directly in Airtable show up, and is cleared at once by any Bridge write.
 * Keep each cached result under 2 MB, which is Vercel's per-entry limit.
 */
export function cachedRecords<TFields>(table: string, filterByFormula?: string): Promise<AirtableRecord<TFields>[]> {
  return unstable_cache(
    () => listAllRecords<TFields>(table, filterByFormula ? { filterByFormula } : undefined),
    ["airtable-records-v1", table, filterByFormula ?? ""],
    { tags: [tableTag(table)], revalidate: TABLE_CACHE_SECONDS }
  )();
}

/** Drop the cached copies of a table after it changes. */
export function invalidateTable(table: string) {
  try {
    revalidateTag(tableTag(table));
  } catch (error) {
    // Outside a Next.js request (scripts, tests) there is no cache to clear.
    if (LOG_TIMING) console.warn(`[airtable] could not invalidate ${table}:`, error instanceof Error ? error.message : error);
  }
}

export function getConfig() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables");
  }
  return { apiKey, baseId };
}

export function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function recordIdOrFormula(ids: string[]): string {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return "FALSE()";
  return `OR(${unique.map((id) => `RECORD_ID()='${escapeFormulaString(id)}'`).join(",")})`;
}

export async function listAllRecords<TFields>(
  table: string,
  options?: { filterByFormula?: string; debugLabel?: string }
): Promise<AirtableRecord<TFields>[]> {
  const { apiKey, baseId } = getConfig();
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;
  const started = Date.now();
  let pages = 0;

  do {
    pages += 1;
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    if (options?.filterByFormula) params.set("filterByFormula", options.filterByFormula);
    const response = await fetch(
      `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`,
      {
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      throw new Error(`Airtable ${table} list failed (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as AirtableListResponse<TFields>;
    records.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);

  logTiming(`list ${table}${options?.filterByFormula ? " (filtered)" : ""} pages=${pages} rows=${records.length}`, started);
  return records;
}

/** Fetch specific records by id, in chunks so the filter formula stays within URL limits. */
export async function listRecordsByIds<TFields>(
  table: string,
  ids: string[]
): Promise<AirtableRecord<TFields>[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const records: AirtableRecord<TFields>[] = [];
  for (let index = 0; index < unique.length; index += 50) {
    records.push(
      ...(await listAllRecords<TFields>(table, {
        filterByFormula: recordIdOrFormula(unique.slice(index, index + 50)),
      }))
    );
  }
  return records;
}

export async function getRecord<TFields>(table: string, id: string): Promise<AirtableRecord<TFields> | null> {
  const { apiKey, baseId } = getConfig();
  const started = Date.now();
  const response = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  logTiming(`get ${table}`, started);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Airtable ${table} get failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as AirtableRecord<TFields>;
}

export async function createRecord(table: string, fields: Record<string, unknown>) {
  const { apiKey, baseId } = getConfig();
  const response = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Airtable ${table} create failed (${response.status}): ${await response.text()}`);
  }
  invalidateTable(table);
  return (await response.json()) as { id: string; fields: Record<string, unknown> };
}

export async function updateRecord(table: string, id: string, fields: Record<string, unknown>) {
  const { apiKey, baseId } = getConfig();
  const response = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Airtable ${table} update failed (${response.status}): ${await response.text()}`);
  }
  invalidateTable(table);
  return (await response.json()) as { id: string; fields: Record<string, unknown> };
}

/** Reserve a retry key without overwriting any existing work or review status. */
export async function reserveRecord(table: string, field: string, value: string) {
  const { apiKey, baseId } = getConfig();
  const response = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: [field] },
      records: [{ fields: { [field]: value } }],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Airtable ${table} reservation failed (${response.status}): ${await response.text()}`);
  invalidateTable(table);
  const data = await response.json() as AirtableListResponse<Record<string, unknown>>;
  if (data.records.length !== 1) throw new Error("Work reference must resolve to exactly one record");
  return data.records[0];
}

export function formatTrack(track?: string | string[]): string {
  if (!track) return "";
  return Array.isArray(track) ? track.filter(Boolean).join(", ") : track;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  return typeof value === "string" && value.trim() ? [value] : [];
}

export function hasStringValue(value: unknown, target: string): boolean {
  if (!Array.isArray(value)) return value === target;
  for (const item of value) {
    if (item === target) return true;
  }
  return false;
}
