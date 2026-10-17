#!/usr/bin/env node
// Additive only: no deletions, renames, record migration or legacy status edits.
import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
dotenv.config({ path: ".env.local", quiet: true });
const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some(arg => arg !== "--apply")) throw new Error("Only --apply is supported");
const base = process.env.AIRTABLE_BASE_ID;
const token = process.env.AIRTABLE_API_KEY;
if (!base || !token) throw new Error("Airtable configuration is missing");
async function request(path, method = "GET", body) {
  await new Promise(resolve => setTimeout(resolve, 260));
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${base}/tables${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Schema ${method} failed (${response.status})`);
  return response.json();
}
const schema = await request("");
const table = name => { const t = schema.tables.find(t => t.name === name); if (!t) throw new Error(`Missing ${name}`); return t; };
const text = name => ({ name, type: "singleLineText" });
const long = name => ({ name, type: "multilineText" });
const number = name => ({ name, type: "number", options: { precision: 0 } });
const decimal = name => ({ name, type: "number", options: { precision: 2 } });
const url = name => ({ name, type: "url" });
const link = (name, target) => ({ name, type: "multipleRecordLinks", options: { linkedTableId: table(target).id } });
const checkbox = name => ({ name, type: "checkbox", options: { icon: "check", color: "greenBright" } });
const desired = {
  Activities: [checkbox("Creates Project"), number("Project Capacity"), number("Project Minimum Quantity"), text("Project Category"), url("Project Guide URL"), link("Created By", "People")],
  Projects: [text("Action Model"), text("Project Key"), text("Action State"), link("Linked Volunteer", "People"),
    text("Volunteer Record ID"), text("Activity Record ID"), link("Linked Signup", "Claims"), link("Linked Center", "Partnerships"),
    text("Action Category"), text("Center Location"), text("Project Deadline"), number("Minimum Quantity"), number("Submitted Quantity"),
    number("Verified Items"), { name: "Project Requested Hours", type: "number", options: { precision: 2 } }, long("Project Work"), text("Delivery Method"), text("Tracking Reference"), long("Center Confirmation"),
    long("Reflection"), { name: "Item Photos", type: "multipleAttachments" }, { name: "Delivery Photos", type: "multipleAttachments" },
    long("Project Review Notes"), long("Review History"), text("Action Submitted At"), text("Action Completed At"),
    link("Action Reviewer", "People"), link("Project Evidence", "Submissions"), text("Center Country"),
    text("Proposal Organization"), text("Proposal Contact Name"), text("Proposal Contact Email"), text("Proposal Contact Phone"),
    long("Proposal Need"), decimal("Proposal Cost"), text("Proposal Completion Date"), checkbox("Gallery Consent"), checkbox("Gallery Published")],
  Claims: [text("Signup Key"), link("Linked Project", "Projects")],
  Hours: [link("Linked Project", "Projects")],
  Submissions: [link("Linked Project", "Projects"), text("Evidence Type"), text("Evidence Key")],
  Partnerships: [text("Country")],
};
const pending = [];
for (const [name, fields] of Object.entries(desired)) {
  for (const field of fields) {
    const existing = table(name).fields.find(f => f.name === field.name);
    if (!existing) pending.push({ table: name, field });
    else if (existing.type !== field.type || (field.options?.linkedTableId && existing.options?.linkedTableId !== field.options.linkedTableId)) throw new Error(`Incompatible existing field: ${name}.${field.name}`);
  }
}
console.log(JSON.stringify({ mode: apply ? "apply" : "preview", additions: pending.map(p => `${p.table}.${p.field.name}`) }, null, 2));
if (!apply || !pending.length) process.exit(0);
const directory = `.migration-backups/education-action-${new Date().toISOString().replaceAll(":", "-")}`;
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(`${directory}/schema-before.json`, JSON.stringify(schema, null, 2), { mode: 0o600 });
const journal = [];
for (const change of pending) {
  const created = await request(`/${table(change.table).id}/fields`, "POST", change.field);
  journal.push({ table: change.table, id: created.id, name: created.name });
  await writeFile(`${directory}/journal.json`, JSON.stringify(journal, null, 2), { mode: 0o600 });
}
const after = await request("");
for (const [name, fields] of Object.entries(desired)) {
  for (const field of fields) if (!after.tables.find(t => t.name === name)?.fields.some(f => f.name === field.name && f.type === field.type)) throw new Error(`Verification failed: ${name}.${field.name}`);
}
await writeFile(`${directory}/schema-after.json`, JSON.stringify(after, null, 2), { mode: 0o600 });
console.log(`Verified ${journal.length} additions. No existing records changed. Backup: ${directory}`);
