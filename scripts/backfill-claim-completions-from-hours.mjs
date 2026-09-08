#!/usr/bin/env node

/**
 * One-time, additive completion backfill for Claims created from legacy signups.
 * A Claim is completed only when an Hours record links the same Person and
 * Activity and has Status = "Approved". Completed At comes from Hours."Review Date".
 *
 * Read-only preview:
 *   node scripts/backfill-claim-completions-from-hours.mjs
 *
 * Apply:
 *   node scripts/backfill-claim-completions-from-hours.mjs --apply
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const API_URL = "https://api.airtable.com/v0";
const HOURS_TABLE = "Hours";
const CLAIMS_TABLE = "Claims";
const LINKED_PERSON_FIELD = "Linked Person";
const LINKED_ACTIVITY_FIELD = "Linked Activity";
const STATUS_FIELD = "Status";
const REVIEW_DATE_FIELD = "Review Date";
const COMPLETED_AT_FIELD = "Completed At";
const HOURS_APPROVED_STATUS = "Approved";
const CLAIMED_STATUS = "Claimed";
const COMPLETED_STATUS = "Completed";
const apply = process.argv.slice(2).includes("--apply");

if (process.argv.slice(2).some((argument) => argument !== "--apply")) {
  throw new Error("Usage: node scripts/backfill-claim-completions-from-hours.mjs [--apply]");
}

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID.");

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

async function listRecords(table, fields) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    for (const field of fields) params.append("fields[]", field);
    if (offset) params.set("offset", offset);
    const page = await request(`${API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`);
    records.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
  return records;
}

async function updateClaims(records) {
  return request(`${API_URL}/${baseId}/${encodeURIComponent(CLAIMS_TABLE)}`, {
    method: "PATCH",
    body: JSON.stringify({ records }),
  });
}

function printSummary({ hoursScanned, approvedRelationships, eligible, updated, skipped, errors }) {
  console.log(`Hours records scanned: ${hoursScanned}`);
  console.log(`Approved Hours relationships found: ${approvedRelationships}`);
  console.log(`Claims eligible for completion: ${eligible}`);
  console.log(`Claims updated to Completed: ${updated}`);
  console.log(`Claims skipped (not Claimed, no matching approved Hours, or no Review Date): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  for (const error of errors) console.error(`  - ${error}`);
}

async function main() {
  const errors = [];
  let hours = [];
  let claims = [];

  try {
    // Targeted reads preflight every field used before any write occurs.
    [hours, claims] = await Promise.all([
      listRecords(HOURS_TABLE, [
        LINKED_PERSON_FIELD,
        LINKED_ACTIVITY_FIELD,
        STATUS_FIELD,
        REVIEW_DATE_FIELD,
      ]),
      listRecords(CLAIMS_TABLE, [
        LINKED_PERSON_FIELD,
        LINKED_ACTIVITY_FIELD,
        STATUS_FIELD,
        COMPLETED_AT_FIELD,
      ]),
    ]);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    printSummary({ hoursScanned: hours.length, approvedRelationships: 0, eligible: 0, updated: 0, skipped: 0, errors });
    process.exitCode = 1;
    return;
  }

  // For each person/activity pair retain the latest review date. This makes
  // repeated approved Hours requests deterministic and preserves the latest
  // completed date for the Claim.
  const approvedAtByPair = new Map();
  let approvedRelationships = 0;
  for (const hour of hours) {
    if (hour.fields[STATUS_FIELD] !== HOURS_APPROVED_STATUS) continue;
    const reviewDate = hour.fields[REVIEW_DATE_FIELD];
    if (typeof reviewDate !== "string" || !reviewDate.trim()) continue;
    for (const personId of asRecordIds(hour.fields[LINKED_PERSON_FIELD])) {
      for (const activityId of asRecordIds(hour.fields[LINKED_ACTIVITY_FIELD])) {
        approvedRelationships += 1;
        const key = pairKey(personId, activityId);
        const previous = approvedAtByPair.get(key);
        if (!previous || reviewDate > previous) approvedAtByPair.set(key, reviewDate);
      }
    }
  }

  let skipped = 0;
  const updates = [];
  for (const claim of claims) {
    const personIds = asRecordIds(claim.fields[LINKED_PERSON_FIELD]);
    const activityIds = asRecordIds(claim.fields[LINKED_ACTIVITY_FIELD]);
    const status = claim.fields[STATUS_FIELD];
    const matchingDates = [];
    for (const personId of personIds) {
      for (const activityId of activityIds) {
        const date = approvedAtByPair.get(pairKey(personId, activityId));
        if (date) matchingDates.push(date);
      }
    }
    const completedAt = matchingDates.sort().at(-1);
    if (status !== CLAIMED_STATUS || !completedAt) {
      skipped += 1;
      continue;
    }
    updates.push({
      id: claim.id,
      fields: { [STATUS_FIELD]: COMPLETED_STATUS, [COMPLETED_AT_FIELD]: completedAt },
    });
  }

  if (!apply) {
    console.log("Preview only: no Airtable records were changed. Re-run with --apply to complete eligible Claims.");
    printSummary({ hoursScanned: hours.length, approvedRelationships, eligible: updates.length, updated: 0, skipped, errors });
    return;
  }

  let updated = 0;
  for (let index = 0; index < updates.length; index += 10) {
    const batch = updates.slice(index, index + 10);
    try {
      await updateClaims(batch);
      updated += batch.length;
      console.log(`Updated Claims ${updated}/${updates.length}.`);
    } catch (error) {
      errors.push(
        `Batch ${Math.floor(index / 10) + 1} (Claims ${index + 1}-${index + batch.length}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (index + 10 < updates.length) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  printSummary({ hoursScanned: hours.length, approvedRelationships, eligible: updates.length, updated, skipped, errors });
  if (errors.length > 0) process.exitCode = 1;
}

await main();
