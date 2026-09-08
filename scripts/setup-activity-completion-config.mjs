#!/usr/bin/env node

/**
 * Bridge V2 additive Airtable setup. Adds activity viewer configuration to Activities
 * without modifying existing activities or legacy Hours/Submissions data.
 *
 * Preview: npm run bridge:setup-activity-completion-config
 * Apply:   npm run bridge:setup-activity-completion-config -- --apply
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const apply = process.argv.slice(2).includes("--apply");
if (process.argv.slice(2).some((argument) => argument !== "--apply")) {
  throw new Error("Usage: npm run bridge:setup-activity-completion-config [-- --apply]");
}

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID.");

const tablesUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const schema = await request(tablesUrl);
const activities = schema.tables.find((table) => table.name === "Activities");
if (!activities) throw new Error("Activities table was not found.");
const claims = schema.tables.find((table) => table.name === "Claims");
const submissions = schema.tables.find((table) => table.name === "Submissions");

const fields = [
  {
    name: "Platform",
    type: "singleSelect",
    options: { choices: [
      { name: "Bridge", color: "blueBright" },
      { name: "Oppia", color: "purpleBright" },
      { name: "Monsoon", color: "cyanBright" },
      { name: "Other", color: "grayBright" },
    ] },
  },
  { name: "Submission Target", type: "number", options: { precision: 0 } },
  { name: "External Project ID", type: "singleLineText" },
  { name: "External Project URL", type: "url" },
];

const existing = new Set(activities.fields.map((field) => field.name));
const missing = fields.filter((field) => !existing.has(field.name));
if (missing.length === 0) {
  console.log("Activities already has Bridge 6 completion configuration; no changes made.");
} else if (!apply) {
  console.log(`Preview only: would add ${missing.map((field) => field.name).join(", ")} to Activities. Re-run with --apply to add them.`);
} else {
  for (const field of missing) {
    await request(`${tablesUrl}/${activities.id}/fields`, {
      method: "POST",
      body: JSON.stringify(field),
    });
  }
  console.log(`Added ${missing.map((field) => field.name).join(", ")} to Activities.`);
}

// Claims let the viewer keep drafts isolated when one person claims the same
// activity more than once. This is additive; existing submissions remain intact.
if (claims && submissions && !submissions.fields.some((field) => field.name === "Linked Claim")) {
  if (!apply) {
    console.log("Preview only: would add Linked Claim to Submissions.");
  } else {
    await request(`${tablesUrl}/${submissions.id}/fields`, {
      method: "POST",
      body: JSON.stringify({ name: "Linked Claim", type: "multipleRecordLinks", options: { linkedTableId: claims.id } }),
    });
    console.log("Added Linked Claim to Submissions.");
  }
}
