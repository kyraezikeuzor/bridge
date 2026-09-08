#!/usr/bin/env node

/**
 * One-time, additive historical migration from Hours to Contributions.
 *
 * Default (or --dry-run): read-only preview.
 * Apply: npm run bridge:backfill-contributions -- --apply
 *
 * Every Hours record is treated independently. A Contribution is created only
 * when no existing Contribution already links that exact Hours record through
 * Contributions."Linked Hours".
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const API_URL = "https://api.airtable.com/v0";
const META_API_URL = "https://api.airtable.com/v0/meta/bases";
const HOURS_TABLE = "Hours";
const CONTRIBUTIONS_TABLE = "Contributions";
const apply = process.argv.slice(2).includes("--apply");

if (
  process.argv
    .slice(2)
    .some((argument) => argument !== "--apply" && argument !== "--dry-run")
) {
  throw new Error(
    "Usage: npm run bridge:backfill-contributions [-- --dry-run | --apply]"
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

const hourFields = [
  "Linked Person",
  "Linked Activity",
  "Linked Submissions",
  "Activity Details",
  "Proof",
  "Proof Link",
  "Request Date",
  "Reviewer",
  "Review Notes",
  "Review Date",
  "Language",
  "Ownership Agreement",
  "Photo Permissions",
  "Assignee",
  "Status",
  "Hours",
];

const contributionFields = [
  "Person",
  "Activity",
  "Linked Submissions",
  "Details",
  "Evidence",
  "Evidence Link",
  "Submitted At",
  "Reviewer",
  "Review Notes",
  "Reviewed At",
  "Language",
  "Ownership Agreement",
  "Photo Permissions",
  "Assignee",
  "Linked Hours",
  "Status",
  "Approved Hours",
  "Calculated Hours",
  "Type",
  "Quantity",
];

function asRecordIds(value) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.length > 0)
    : [];
}

function attachmentsForCreate(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((attachment) => attachment && typeof attachment.url === "string")
    .map((attachment) => ({
      url: attachment.url,
      ...(typeof attachment.filename === "string"
        ? { filename: attachment.filename }
        : {}),
    }));
}

function populated(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function dateForDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  // Historical Hours fields are date-only while Contributions uses date/time.
  // Preserve that calendar date with an explicit, deterministic midnight UTC.
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
  const tables = new Map(schema.tables.map((table) => [table.name, table]));
  const missing = [];
  for (const [tableName, expectedFields] of [
    [HOURS_TABLE, hourFields],
    [CONTRIBUTIONS_TABLE, contributionFields],
  ]) {
    const table = tables.get(tableName);
    if (!table) {
      missing.push(`table ${tableName}`);
      continue;
    }
    const actual = new Set(table.fields.map((field) => field.name));
    for (const field of expectedFields) {
      if (!actual.has(field)) missing.push(`${tableName}.${field}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Required Airtable schema is missing: ${missing.join(", ")}`);
  }
}

function fieldsForHour(hour) {
  const source = hour.fields;
  const fields = { "Linked Hours": [hour.id] };
  const mappings = [
    ["Linked Person", "Person"],
    ["Linked Activity", "Activity"],
    ["Linked Submissions", "Linked Submissions"],
    ["Activity Details", "Details"],
    ["Proof Link", "Evidence Link"],
    ["Reviewer", "Reviewer"],
    ["Review Notes", "Review Notes"],
    ["Language", "Language"],
    ["Ownership Agreement", "Ownership Agreement"],
    ["Photo Permissions", "Photo Permissions"],
    ["Assignee", "Assignee"],
  ];
  for (const [from, to] of mappings) {
    if (populated(source[from])) fields[to] = source[from];
  }
  const submittedAt = dateForDateTime(source["Request Date"]);
  if (submittedAt) fields["Submitted At"] = submittedAt;
  const reviewedAt = dateForDateTime(source["Review Date"]);
  if (reviewedAt) fields["Reviewed At"] = reviewedAt;

  const evidence = attachmentsForCreate(source.Proof);
  if (evidence.length > 0) fields.Evidence = evidence;

  const submissions = asRecordIds(source["Linked Submissions"]);
  if (submissions.length > 0) {
    fields.Type = "Submission";
    fields.Quantity = submissions.length;
  }

  const status = source.Status;
  if (["Submitted", "Approved", "Rejected"].includes(status)) {
    fields.Status = status;
    if (status === "Approved" && populated(source.Hours)) {
      fields["Approved Hours"] = source.Hours;
    }
  }
  // Claim, Platform, Completed At, Calculated Hours, External Reference, and
  // Contribution Type intentionally remain blank: they cannot be reconstructed.
  return fields;
}

async function createContribution(fields) {
  return request(`${API_URL}/${baseId}/${encodeURIComponent(CONTRIBUTIONS_TABLE)}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

function printSummary(summary) {
  console.log(`Hours records scanned: ${summary.scanned}`);
  console.log(`Contributions created: ${summary.created}`);
  console.log(`Existing Contributions skipped: ${summary.skipped}`);
  console.log(`Approved records migrated: ${summary.approved}`);
  console.log(`Submitted records migrated: ${summary.submitted}`);
  console.log(`Rejected records migrated: ${summary.rejected}`);
  console.log(`Records missing Person: ${summary.missingPerson}`);
  console.log(`Records missing Activity: ${summary.missingActivity}`);
  console.log(`Errors: ${summary.errors.length}`);
  for (const error of summary.errors) console.error(`  - ${error}`);
}

async function main() {
  const summary = {
    scanned: 0,
    created: 0,
    skipped: 0,
    approved: 0,
    submitted: 0,
    rejected: 0,
    missingPerson: 0,
    missingActivity: 0,
    errors: [],
  };

  let hours;
  let contributions;
  try {
    await inspectSchema();
    [hours, contributions] = await Promise.all([
      listRecords(HOURS_TABLE, hourFields),
      listRecords(CONTRIBUTIONS_TABLE, ["Linked Hours"]),
    ]);
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error));
    printSummary(summary);
    process.exitCode = 1;
    return;
  }

  summary.scanned = hours.length;
  const existingHourIds = new Set(
    contributions.flatMap((contribution) =>
      asRecordIds(contribution.fields["Linked Hours"])
    )
  );
  const pending = [];

  for (const hour of hours) {
    if (existingHourIds.has(hour.id)) {
      summary.skipped += 1;
      continue;
    }
    if (asRecordIds(hour.fields["Linked Person"]).length === 0) {
      summary.missingPerson += 1;
    }
    if (asRecordIds(hour.fields["Linked Activity"]).length === 0) {
      summary.missingActivity += 1;
    }
    pending.push(hour);
  }

  if (!apply) {
    console.log("Dry run: no Airtable records were changed. Re-run with --apply to create Contributions.");
    printSummary(summary);
    return;
  }

  for (const hour of pending) {
    try {
      await createContribution(fieldsForHour(hour));
      summary.created += 1;
      if (hour.fields.Status === "Approved") summary.approved += 1;
      if (hour.fields.Status === "Submitted") summary.submitted += 1;
      if (hour.fields.Status === "Rejected") summary.rejected += 1;
    } catch (error) {
      summary.errors.push(
        `Hours ${hour.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  printSummary(summary);
  if (summary.errors.length > 0) process.exitCode = 1;
}

await main();
