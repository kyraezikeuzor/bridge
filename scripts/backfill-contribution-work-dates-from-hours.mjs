#!/usr/bin/env node

/**
 * One-time, additive historical work-date migration from Hours to
 * already-linked Contributions.
 *
 * Default (or --dry-run): read-only preview.
 * Apply: npm run bridge:backfill-contribution-work-dates -- --apply
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const API_URL = "https://api.airtable.com/v0";
const META_API_URL = "https://api.airtable.com/v0/meta/bases";
const HOURS_TABLE = "Hours";
const CONTRIBUTIONS_TABLE = "Contributions";
const START_DATE = "Activity Start Date";
const END_DATE = "Activity End Date";
const LINKED_CONTRIBUTIONS = "Linked Contributions";
const STARTED_AT = "Started At";
const COMPLETED_AT = "Completed At";
const apply = process.argv.slice(2).includes("--apply");

if (
  process.argv
    .slice(2)
    .some((argument) => argument !== "--apply" && argument !== "--dry-run")
) {
  throw new Error(
    "Usage: npm run bridge:backfill-contribution-work-dates [-- --dry-run | --apply]"
  );
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

function populated(value) {
  return value !== undefined && value !== null && value !== "";
}

function dateForDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
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
    const page = await request(
      `${API_URL}/${baseId}/${encodeURIComponent(table)}?${params}`
    );
    records.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
  return records;
}

async function inspectSchema() {
  const schema = await request(`${META_API_URL}/${baseId}/tables`);
  const required = new Map([
    [HOURS_TABLE, [START_DATE, END_DATE, LINKED_CONTRIBUTIONS]],
    [CONTRIBUTIONS_TABLE, [STARTED_AT, COMPLETED_AT]],
  ]);
  const missing = [];
  for (const [tableName, fields] of required) {
    const table = schema.tables.find((candidate) => candidate.name === tableName);
    if (!table) {
      missing.push(`table ${tableName}`);
      continue;
    }
    const actual = new Set(table.fields.map((field) => field.name));
    for (const field of fields) {
      if (!actual.has(field)) missing.push(`${tableName}.${field}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Required Airtable schema is missing: ${missing.join(", ")}`);
  }
}

async function updateContribution(id, fields) {
  return request(
    `${API_URL}/${baseId}/${encodeURIComponent(CONTRIBUTIONS_TABLE)}/${id}`,
    { method: "PATCH", body: JSON.stringify({ fields }) }
  );
}

function printSummary(summary) {
  console.log(`Hours records scanned: ${summary.scanned}`);
  console.log(`Contributions updated: ${summary.updated}`);
  console.log(`Records skipped because dates were already populated: ${summary.alreadyPopulated}`);
  console.log(`Records with no linked Contribution: ${summary.noLinkedContribution}`);
  console.log(`Records with multiple linked Contributions: ${summary.multipleLinkedContributions}`);
  console.log(`Records with no start/end date data: ${summary.noDateData}`);
  console.log(`Errors: ${summary.errors.length}`);
  for (const error of summary.errors) console.error(`  - ${error}`);
}

async function main() {
  const summary = {
    scanned: 0,
    updated: 0,
    alreadyPopulated: 0,
    noLinkedContribution: 0,
    multipleLinkedContributions: 0,
    noDateData: 0,
    errors: [],
  };

  let hours;
  let contributions;
  try {
    await inspectSchema();
    [hours, contributions] = await Promise.all([
      listRecords(HOURS_TABLE, [START_DATE, END_DATE, LINKED_CONTRIBUTIONS]),
      listRecords(CONTRIBUTIONS_TABLE, [STARTED_AT, COMPLETED_AT]),
    ]);
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error));
    printSummary(summary);
    process.exitCode = 1;
    return;
  }

  summary.scanned = hours.length;
  const contributionById = new Map(
    contributions.map((contribution) => [contribution.id, contribution])
  );
  const updates = [];

  for (const hour of hours) {
    const startDate = hour.fields[START_DATE];
    const endDate = hour.fields[END_DATE];
    if (!populated(startDate) && !populated(endDate)) {
      summary.noDateData += 1;
      continue;
    }

    const contributionIds = asRecordIds(hour.fields[LINKED_CONTRIBUTIONS]);
    if (contributionIds.length === 0) {
      summary.noLinkedContribution += 1;
      continue;
    }
    if (contributionIds.length > 1) {
      summary.multipleLinkedContributions += 1;
      continue;
    }

    const contribution = contributionById.get(contributionIds[0]);
    if (!contribution) {
      summary.errors.push(
        `Hours ${hour.id} links Contribution ${contributionIds[0]}, which could not be read.`
      );
      continue;
    }

    const fields = {};
    if (populated(startDate) && !populated(contribution.fields[STARTED_AT])) {
      fields[STARTED_AT] = startDate;
    }
    if (populated(endDate) && !populated(contribution.fields[COMPLETED_AT])) {
      fields[COMPLETED_AT] = dateForDateTime(endDate);
    }
    if (Object.keys(fields).length === 0) {
      summary.alreadyPopulated += 1;
      continue;
    }
    updates.push({ hourId: hour.id, contributionId: contribution.id, fields });
  }

  if (!apply) {
    console.log("Dry run: no Airtable records were changed. Re-run with --apply to populate work dates.");
    // In preview, "updated" intentionally reports the count that would update.
    summary.updated = updates.length;
    printSummary(summary);
    return;
  }

  for (const update of updates) {
    try {
      await updateContribution(update.contributionId, update.fields);
      summary.updated += 1;
    } catch (error) {
      summary.errors.push(
        `Hours ${update.hourId} / Contribution ${update.contributionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  printSummary(summary);
  if (summary.errors.length > 0) process.exitCode = 1;
}

await main();
