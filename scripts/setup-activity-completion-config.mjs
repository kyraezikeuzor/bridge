#!/usr/bin/env node
// Additive schema setup for activity completion. Preview by default; --apply creates only missing fields.
import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";

dotenv.config({ path: ".env.local", quiet: true });
const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some((argument) => argument !== "--apply")) throw new Error("Only --apply is supported");
const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_API_KEY;
if (!baseId || !apiKey) throw new Error("Airtable configuration is missing");

async function request(path = "", method = "GET", body) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Airtable schema ${method} failed (${response.status})`);
  return response.json();
}

const schema = await request();
const desired = {
  Activities: [{ name: "Completion Workflow", type: "singleLineText" }],
  Submissions: [{ name: "Evidence Key", type: "singleLineText" }],
  Hours: [{ name: "Proof", type: "multipleAttachments" }],
};
const pending = [];
for (const [tableName, fields] of Object.entries(desired)) {
  const table = schema.tables.find((item) => item.name === tableName);
  if (!table) throw new Error(`Missing Airtable table: ${tableName}`);
  for (const field of fields) {
    const existing = table.fields.find((item) => item.name === field.name);
    if (!existing) pending.push({ table, field });
    else if (existing.type !== field.type) throw new Error(`Incompatible existing field: ${tableName}.${field.name}`);
  }
}

console.log(JSON.stringify({ mode: apply ? "apply" : "preview", additions: pending.map(({ table, field }) => `${table.name}.${field.name}`) }, null, 2));
if (!apply || !pending.length) process.exit(0);

const backup = `.migration-backups/activity-completion-${new Date().toISOString().replaceAll(":", "-")}`;
await mkdir(backup, { recursive: true, mode: 0o700 });
await writeFile(`${backup}/schema-before.json`, JSON.stringify(schema, null, 2), { mode: 0o600 });
const journal = [];
for (const { table, field } of pending) {
  const created = await request(`/${table.id}/fields`, "POST", field);
  journal.push({ table: table.name, id: created.id, name: created.name });
  await writeFile(`${backup}/journal.json`, JSON.stringify(journal, null, 2), { mode: 0o600 });
}
const after = await request();
for (const [tableName, fields] of Object.entries(desired)) {
  const table = after.tables.find((item) => item.name === tableName);
  for (const field of fields) {
    if (!table?.fields.some((item) => item.name === field.name && item.type === field.type)) throw new Error(`Verification failed: ${tableName}.${field.name}`);
  }
}
await writeFile(`${backup}/schema-after.json`, JSON.stringify(after, null, 2), { mode: 0o600 });
console.log(`Verified ${journal.length} additions. No records changed. Backup: ${backup}`);
