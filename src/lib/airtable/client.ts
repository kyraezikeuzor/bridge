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

  do {
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

  return records;
}

export async function getRecord<TFields>(table: string, id: string): Promise<AirtableRecord<TFields> | null> {
  const { apiKey, baseId } = getConfig();
  const response = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
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
  return (await response.json()) as { id: string; fields: Record<string, unknown> };
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
