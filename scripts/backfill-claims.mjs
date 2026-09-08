#!/usr/bin/env node

/**
 * Bridge 2 Airtable migration. Creates Claims if needed, then adds one claim
 * per old Activities."Linked Sign Ups" person/activity pair. It never edits
 * Activities, People, Submissions, or Hours.
 *
 * Preview: npm run bridge:backfill-claims
 * Apply:   npm run bridge:backfill-claims -- --apply
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const API_URL = "https://api.airtable.com/v0";
const META_API_URL = "https://api.airtable.com/v0/meta";
const apply = process.argv.includes("--apply");
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID.");

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url} failed (${response.status}): ${await response.text()}`);
  return response.json();
}
async function listRecords(table) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const page = await request(`${API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`);
    records.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
  return records;
}
function isClaimsUnavailableError(error) {
  return (
    error instanceof Error &&
    (error.message.includes("failed (404)") || error.message.includes("failed (403)"))
  );
}
async function createClaimsTable() {
  const schema = await request(`${META_API_URL}/bases/${baseId}/tables`);
  const existing = schema.tables.find((table) => table.name === "Claims");
  if (existing) return existing;
  const people = schema.tables.find((table) => table.name === "People");
  const activities = schema.tables.find((table) => table.name === "Activities");
  if (!people || !activities) throw new Error("Expected People and Activities tables before creating Claims.");
  const payload = {
    name: "Claims",
    description: "Bridge commitments. Added by the Bridge 2 migration.",
    fields: [
      { name: "Claim", type: "singleLineText" },
      { name: "Linked Person", type: "multipleRecordLinks", options: { linkedTableId: people.id } },
      { name: "Linked Activity", type: "multipleRecordLinks", options: { linkedTableId: activities.id } },
      { name: "Status", type: "singleSelect", options: { choices: [
        { name: "Active", color: "greenBright" },
        { name: "Completed", color: "blueBright" },
        { name: "Cancelled", color: "grayBright" },
      ] } },
      { name: "External Claim ID", type: "singleLineText" },
    ],
  };
  if (!apply) {
    console.log("Preview: Claims table is missing and would be created.");
    return null;
  }
  console.log("Creating additive Claims table…");
  return request(`${META_API_URL}/bases/${baseId}/tables`, { method: "POST", body: JSON.stringify(payload) });
}
const asIds = (value) => Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
const pairKey = (personId, activityId) => `${personId}:${activityId}`;
async function main() {
  let claims;
  try {
    // The regular data scope is enough for an existing Claims table. Only a
    // first-time table creation needs Airtable's schema.bases scopes.
    claims = await listRecords("Claims");
  } catch (error) {
    if (!isClaimsUnavailableError(error)) throw error;
    try {
      const claimsTable = await createClaimsTable();
      if (!claimsTable) return;
      claims = [];
    } catch (schemaError) {
      if (
        schemaError instanceof Error &&
        schemaError.message.includes("failed (403)")
      ) {
        throw new Error(
          "Claims is unavailable and this token cannot inspect or create its schema. Grant the token access to Claims plus schema.bases:read and schema.bases:write on this base, or create Claims in Airtable and grant it data access before rerunning this command."
        );
      }
      throw schemaError;
    }
  }
  const activities = await listRecords("Activities");
  const existing = new Set();
  for (const claim of claims) for (const personId of asIds(claim.fields["Linked Person"])) for (const activityId of asIds(claim.fields["Linked Activity"])) existing.add(pairKey(personId, activityId));
  const records = [];
  for (const activity of activities) for (const personId of asIds(activity.fields["Linked Sign Ups"])) {
    if (!existing.has(pairKey(personId, activity.id))) records.push({ fields: {
      Claim: `${personId} · ${activity.id}`,
      "Linked Person": [personId], "Linked Activity": [activity.id], Status: "Active",
    } });
  }
  console.log(`${apply ? "Creating" : "Preview:"} ${records.length} missing claim(s).`);
  if (!apply) return;
  for (let index = 0; index < records.length; index += 10) {
    const chunk = records.slice(index, index + 10);
    await request(`${API_URL}/${baseId}/Claims`, { method: "POST", body: JSON.stringify({ records: chunk }) });
    console.log(`Created ${Math.min(index + chunk.length, records.length)}/${records.length} claim(s).`);
  }
}
await main();
