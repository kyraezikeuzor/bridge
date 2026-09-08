#!/usr/bin/env node

/**
 * One-time, additive migration from Activities."Linked Sign Ups" to Claims.
 *
 * Read-only preview:
 *   node scripts/migrate-activity-signups-to-claims.mjs
 *
 * Apply:
 *   node scripts/migrate-activity-signups-to-claims.mjs --apply
 *
 * The script never updates Activities, People, Submissions, Hours, or existing
 * Claims. It creates only missing Person + Activity claim pairs.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const API_URL = "https://api.airtable.com/v0";
const ACTIVITIES_TABLE = "Activities";
const CLAIMS_TABLE = "Claims";
const LEGACY_SIGNUP_FIELD = "Linked Sign Ups";
const CLAIM_PERSON_FIELD = "Linked Person";
const CLAIM_ACTIVITY_FIELD = "Linked Activity";
const CLAIM_STATUS_FIELD = "Status";
const CLAIMED_AT_FIELD = "Claimed At";
const COMPLETED_AT_FIELD = "Completed At";
const CLAIM_STATUS = "Claimed";
const apply = process.argv.slice(2).includes("--apply");

if (process.argv.slice(2).some((argument) => argument !== "--apply")) {
  throw new Error("Usage: node scripts/migrate-activity-signups-to-claims.mjs [--apply]");
}

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) {
  throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID.");
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

function asRecordIds(value) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.length > 0)
    : [];
}

function pairKey(personId, activityId) {
  return `${personId}:${activityId}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options });
  if (!response.ok) {
    throw new Error(
      `${options.method || "GET"} ${url} failed (${response.status}): ${await response.text()}`
    );
  }
  return response.json();
}

/** Lists every record while also verifying the specified field names exist. */
async function listRecords(table, fields) {
  const records = [];
  let offset;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    for (const field of fields) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const page = await request(
      `${API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`
    );
    records.push(...(page.records || []));
    offset = page.offset;
  } while (offset);

  return records;
}

async function createClaims(pairs) {
  return request(`${API_URL}/${baseId}/${encodeURIComponent(CLAIMS_TABLE)}`, {
    method: "POST",
    body: JSON.stringify({
      records: pairs.map(({ personId, activityId }) => ({
        fields: {
          [CLAIM_PERSON_FIELD]: [personId],
          [CLAIM_ACTIVITY_FIELD]: [activityId],
          [CLAIM_STATUS_FIELD]: CLAIM_STATUS,
        },
      })),
    }),
  });
}

async function main() {
  const errors = [];
  let activities = [];
  let claims = [];

  try {
    // These targeted reads act as a field-name preflight before any write.
    [activities, claims] = await Promise.all([
      listRecords(ACTIVITIES_TABLE, [LEGACY_SIGNUP_FIELD]),
      listRecords(CLAIMS_TABLE, [
        CLAIM_PERSON_FIELD,
        CLAIM_ACTIVITY_FIELD,
        CLAIM_STATUS_FIELD,
        CLAIMED_AT_FIELD,
        COMPLETED_AT_FIELD,
      ]),
    ]);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    printSummary({ activities, legacyRelationships: 0, created: 0, skipped: 0, errors });
    process.exitCode = 1;
    return;
  }

  const existingPairs = new Set();
  for (const claim of claims) {
    for (const personId of asRecordIds(claim.fields[CLAIM_PERSON_FIELD])) {
      for (const activityId of asRecordIds(claim.fields[CLAIM_ACTIVITY_FIELD])) {
        existingPairs.add(pairKey(personId, activityId));
      }
    }
  }

  let legacyRelationships = 0;
  let skipped = 0;
  const missingPairs = [];
  const seenLegacyPairs = new Set();

  for (const activity of activities) {
    for (const personId of asRecordIds(activity.fields[LEGACY_SIGNUP_FIELD])) {
      legacyRelationships += 1;
      const key = pairKey(personId, activity.id);

      // Linked-record values should already be unique, but avoid duplicate work
      // even if Airtable returns the same relationship more than once.
      if (seenLegacyPairs.has(key)) continue;
      seenLegacyPairs.add(key);

      if (existingPairs.has(key)) {
        skipped += 1;
      } else {
        missingPairs.push({ personId, activityId: activity.id, key });
      }
    }
  }

  if (!apply) {
    console.log("Preview only: no Airtable records were changed. Re-run with --apply to create missing Claims.");
    printSummary({ activities, legacyRelationships, created: 0, skipped, pending: missingPairs.length, errors });
    return;
  }

  let created = 0;
  // Airtable accepts at most 10 creates per request and permits 5 requests per
  // second per base. Four requests per second leaves headroom for the base.
  for (let index = 0; index < missingPairs.length; index += 10) {
    const batch = missingPairs.slice(index, index + 10);
    try {
      await createClaims(batch);
      for (const { key } of batch) existingPairs.add(key);
      created += batch.length;
      console.log(`Created Claims ${created}/${missingPairs.length}.`);
    } catch (error) {
      errors.push(
        `Batch ${Math.floor(index / 10) + 1} (Claims ${index + 1}-${index + batch.length}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (index + 10 < missingPairs.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  printSummary({ activities, legacyRelationships, created, skipped, errors });
  if (errors.length > 0) process.exitCode = 1;
}

function printSummary({ activities, legacyRelationships, created, skipped, pending, errors }) {
  console.log(`Activities scanned: ${activities.length}`);
  console.log(`Legacy signup relationships found: ${legacyRelationships}`);
  console.log(`Claims created: ${created}`);
  if (pending !== undefined) console.log(`Claims that would be created: ${pending}`);
  console.log(`Skipped because a Claim already existed: ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  for (const error of errors) console.error(`  - ${error}`);
}

await main();
