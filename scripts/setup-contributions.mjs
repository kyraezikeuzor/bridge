#!/usr/bin/env node

/**
 * Bridge 4 additive Airtable setup. Creates the Contributions table if it is
 * missing. This never changes existing People, Activities, Claims, Submissions,
 * or Hours records.
 *
 * Preview: npm run bridge:setup-contributions
 * Apply:   npm run bridge:setup-contributions -- --apply
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const apply = process.argv.slice(2).includes("--apply");
if (process.argv.slice(2).some((argument) => argument !== "--apply")) {
  throw new Error("Usage: npm run bridge:setup-contributions [-- --apply]");
}

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) throw new Error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID.");

const schemaUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
const contributionsUrl = `https://api.airtable.com/v0/${baseId}/Contributions?pageSize=1`;
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

async function schemaRequest(options = {}) {
  const response = await fetch(schemaUrl, { headers, ...options });
  if (!response.ok) {
    const details = await response.text();
    if (response.status === 403) {
      throw new Error(
        "Contributions is not available and this token cannot inspect or create Airtable schema. " +
          "Grant this token schema.bases:read and schema.bases:write plus access to this base, " +
          "or create the Contributions table manually and grant the token data access to it."
      );
    }
    throw new Error(`${options.method || "GET"} Contributions schema failed (${response.status}): ${details}`);
  }
  return response.json();
}

// A data-scope token can use an existing table even when it lacks the separate
// schema scopes needed to inspect or create tables.
const existingTableResponse = await fetch(contributionsUrl, { headers });
if (existingTableResponse.ok) {
  const schema = await schemaRequest();
  const contributions = schema.tables.find((table) => table.name === "Contributions");
  if (!contributions) throw new Error("Contributions data is available but its schema could not be found.");
  const submissions = schema.tables.find((table) => table.name === "Submissions");
  const additions = [
    { name: "Hours Record ID", type: "singleLineText" },
    { name: "Certificate Hours", type: "number", options: { precision: 2 } },
    { name: "Verified Hours", type: "number", options: { precision: 2 } },
    ...(submissions ? [{ name: "Linked Submissions", type: "multipleRecordLinks", options: { linkedTableId: submissions.id } }] : []),
  ].filter((field) => !contributions.fields.some((existing) => existing.name === field.name));
  if (additions.length === 0) {
    console.log("Contributions table already has the Bridge 5, Bridge 7, and Bridge 8 fields; no changes made.");
  } else if (!apply) {
    console.log(`Preview only: Contributions needs ${additions.map((field) => field.name).join(", ")}. Re-run with --apply to add ${additions.length === 1 ? "it" : "them"}.`);
  } else {
    for (const field of additions) {
      await fetch(`${schemaUrl}/${contributions.id}/fields`, {
        method: "POST",
        headers,
        body: JSON.stringify(field),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Add ${field.name} field failed (${response.status}): ${await response.text()}`);
      });
    }
    console.log(`Added ${additions.map((field) => field.name).join(", ")} to Contributions.`);
  }
} else {
  const schema = await schemaRequest();
  if (schema.tables.some((table) => table.name === "Contributions")) {
    throw new Error("Contributions exists but this token cannot access its data. Grant the token data.records:read and data.records:write access to this base.");
  }
  const people = schema.tables.find((table) => table.name === "People");
  const activities = schema.tables.find((table) => table.name === "Activities");
  const claims = schema.tables.find((table) => table.name === "Claims");
  const submissions = schema.tables.find((table) => table.name === "Submissions");
  if (!people || !activities || !claims || !submissions) {
    throw new Error("People, Activities, Claims, and Submissions tables must exist before Contributions can be created.");
  }

  const payload = {
    name: "Contributions",
    description: "Completed volunteer work submitted through Bridge. Added by the Bridge 4 setup.",
    fields: [
      { name: "Contribution", type: "singleLineText" },
      { name: "Linked Person", type: "multipleRecordLinks", options: { linkedTableId: people.id } },
      { name: "Linked Claim", type: "multipleRecordLinks", options: { linkedTableId: claims.id } },
      { name: "Linked Activity", type: "multipleRecordLinks", options: { linkedTableId: activities.id } },
      { name: "Linked Submissions", type: "multipleRecordLinks", options: { linkedTableId: submissions.id } },
      { name: "Work Link", type: "url" },
      { name: "Notes", type: "multilineText" },
      { name: "Status", type: "singleSelect", options: { choices: [
        { name: "Submitted", color: "yellowBright" },
        { name: "Approved", color: "greenBright" },
        { name: "Rejected", color: "redBright" },
      ] } },
      { name: "Submitted At", type: "dateTime", options: { dateFormat: { name: "local" }, timeFormat: { name: "24hour" }, timeZone: "client" } },
      { name: "External Contribution ID", type: "singleLineText" },
      { name: "Hours Record ID", type: "singleLineText" },
      { name: "Certificate Hours", type: "number", options: { precision: 2 } },
      { name: "Verified Hours", type: "number", options: { precision: 2 } },
    ],
  };

  if (!apply) {
    console.log("Preview only: Contributions table is missing and would be created. Re-run with --apply to create it.");
  } else {
    await schemaRequest({ method: "POST", body: JSON.stringify(payload) });
    console.log("Created additive Contributions table.");
  }
}
