import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url), ts = require("typescript");
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Map, Set, Promise, Error, Number, JSON, console, require: name => { if (!(name in mocks)) throw Error(`Unexpected ${name}`); return mocks[name]; } });
  return module.exports;
}
const rules = load("src/lib/projectRules.ts");
test("attendance never creates projects and legacy activities opt out", () => {
  assert.equal(rules.createsProject("Attendance", true), false);
  assert.equal(rules.createsProject("Submission", false), false);
  assert.equal(rules.createsProject("Submission", true), true);
  assert.equal(rules.createsProject("Participation", true), true);
});
test("kits always require at least 30; private default name uses last initial", () => {
  assert.equal(rules.minimumQuantity("School Kits", 15), 30);
  assert.equal(rules.minimumQuantity("Care Kits", 45), 45);
  assert.equal(rules.projectTitle("Leyla", "Asgarli", "School Kits", "Center"), "Leyla A. — School Kits — Center");
});
const evidence = { quantity: 30, work: "Letters", method: "Shipped", itemPhotos: 1, deliveryPhotos: 0, tracking: "Carrier 123", confirmation: "" };
test("shipped and in-person evidence requirements are distinct", () => {
  assert.equal(rules.submissionError("School Kits", 30, evidence), null);
  assert.ok(rules.submissionError("School Kits", 30, { ...evidence, tracking: "" }));
  assert.ok(rules.submissionError("School Kits", 30, { ...evidence, itemPhotos: 0 }));
  assert.ok(rules.submissionError("School Kits", 30, { ...evidence, method: "In person" }));
  assert.equal(rules.submissionError("School Kits", 30, { ...evidence, method: "In person", confirmation: "Staff confirmation; no photography permitted" }), null);
  assert.ok(rules.submissionError("School Kits", 30, { ...evidence, quantity: 29.5 }));
});
test("letters and service days do not require kit delivery photos", () => {
  assert.equal(rules.submissionError("Letters", 30, { ...evidence, method: "Omelora mailing", itemPhotos: 0 }), null);
  assert.ok(rules.submissionError("Letters", 30, { ...evidence, method: "Omelora mailing", work: "" }));
  assert.equal(rules.submissionError("Service Day", 1, { ...evidence, method: "Service confirmation", itemPhotos: 0, confirmation: "Center verified" }), null);
});
test("completion requires separate work approval and verification", () => {
  assert.throws(() => rules.reviewTransition("Submitted", "complete", "Received"));
  assert.equal(rules.reviewTransition("Submitted", "approve-work", "Approved"), "Awaiting Delivery");
  assert.throws(() => rules.reviewTransition("Awaiting Delivery", "complete", ""));
  assert.equal(rules.reviewTransition("Awaiting Delivery", "complete", "Received"), "Completed");
  assert.throws(() => rules.reviewTransition("Completed", "request-changes", "Revise"));
});
function fixture() {
  let sequence = 0, tail = Promise.resolve();
  const db = { Activities: [{ id: "recActivity", fields: { "Activity Name": "School Kits", Type: "Submission", Category: "School Kits", "Creates Project": true, Status: "Active", "Linked Service Center": ["recCenter"], "End Date": "2099-12-31" } }], Partnerships: [{ id: "recCenter", fields: { Name: "Center", Status: ["Accepted"], Location: "Town" } }], Projects: [], Claims: [], Hours: [], Submissions: [] };
  const client = {
    asStringArray: value => Array.isArray(value) ? value : [],
    getRecord: async (table, id) => db[table].find(r => r.id === id) || null,
    listAllRecords: async (table, opts) => {
      const filter = opts?.filterByFormula || "";
      if (filter.startsWith("{Project Key}")) return db[table].filter(r => r.fields["Project Key"] === filter.split("'")[1]);
      if (filter.includes("Activity Record ID")) return db[table].filter(r => r.fields["Activity Record ID"] === "recActivity");
      return db[table];
    },
    reserveRecord: async (table, field, value) => {
      let record = db[table].find(r => r.fields[field] === value);
      if (!record) { record = { id: `rec${++sequence}`, createdTime: new Date().toISOString(), fields: { [field]: value } }; db[table].push(record); }
      return record;
    },
    updateRecord: async (table, id, fields) => { const record = db[table].find(r => r.id === id); Object.assign(record.fields, fields); return record; },
  };
  const people = { getPersonById: async id => ({ id, role: id === "recDirector" ? "Executive Director" : "Volunteer", fields: { "First Name": "Test", "Last Name": "Volunteer" } }) };
  const models = load("src/lib/airtable/projects.ts", { "./client": client });
  const service = load("src/lib/projectService.ts", {
    "./prisma": { prisma: { $transaction: action => {
      const pending = tail.then(() => action({ $queryRaw: async () => [] })); tail = pending.catch(() => {}); return pending;
    } } }, "./airtable/client": client, "./airtable/people": people,
    "./airtable/projects": models, "./projectRules": rules,
  });
  return { db, service };
}
test("signup retries create exactly one project and claim", async () => {
  const { db, service } = fixture();
  const [a,b] = await Promise.all([service.startProject("recPerson", "recActivity"), service.startProject("recPerson", "recActivity")]);
  assert.equal(a.id, b.id); assert.equal(db.Projects.length, 1); assert.equal(db.Claims.length, 1); assert.equal(db.Hours.length, 0);
});
test("proposal retries create one review-only project without claims or hours", async () => {
  const { db, service } = fixture();
  const input = {
    requestId: "request-1",
    title: "Neighborhood reading corner",
    organization: "Community Center",
    contactName: "Adult Contact",
    contactEmail: "adult@example.org",
    contactPhone: "",
    need: "Books and shelving for an after-school reading space.",
    cost: 250,
    completionDate: "2099-12-31",
  };
  const [a, b] = await Promise.all([
    service.proposeProject("recPerson", input),
    service.proposeProject("recPerson", input),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(db.Projects.length, 1);
  assert.equal(db.Projects[0].fields["Action State"], "Proposed");
  assert.equal(db.Projects[0].fields["Proposal Organization"], "Community Center");
  assert.equal(db.Claims.length, 0);
  assert.equal(db.Hours.length, 0);
});
test("proposal validation rejects invalid contacts, dates, and costs before writing", async () => {
  const { db, service } = fixture();
  const valid = {
    requestId: "request-2",
    title: "Neighborhood reading corner",
    organization: "Community Center",
    contactName: "Adult Contact",
    contactEmail: "adult@example.org",
    contactPhone: "",
    need: "Books and shelving.",
    cost: 250,
    completionDate: "2099-12-31",
  };
  await assert.rejects(service.proposeProject("recPerson", { ...valid, contactEmail: "not-an-email" }));
  await assert.rejects(service.proposeProject("recPerson", { ...valid, completionDate: "2000-01-01" }));
  await assert.rejects(service.proposeProject("recPerson", { ...valid, cost: -1 }));
  assert.equal(db.Projects.length, 0);
});
test("director proposal review records one planning decision without starting work", async () => {
  const { db, service } = fixture();
  const proposal = await service.proposeProject("recPerson", {
    requestId: "request-3",
    title: "Neighborhood reading corner",
    organization: "Community Center",
    contactName: "Adult Contact",
    contactEmail: "adult@example.org",
    contactPhone: "",
    need: "Books and shelving.",
    cost: 250,
    completionDate: "2099-12-31",
  });
  await assert.rejects(service.reviewProposal("recPerson", proposal.id, "approve-proposal", "Looks feasible."));
  const reviewed = await service.reviewProposal("recDirector", proposal.id, "approve-proposal", "Verify the center, then create the activity.");
  assert.equal(reviewed.state, "Proposal Approved");
  assert.equal(db.Claims.length, 0);
  assert.equal(db.Hours.length, 0);
  await assert.rejects(service.reviewProposal("recDirector", proposal.id, "reject-proposal", "Conflicting decision."));
});
test("five slots are enforced under concurrent starts", async () => {
  const { db, service } = fixture();
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => service.startProject(`recPerson${i}`, "recActivity")));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 5); assert.equal(db.Projects.length, 5);
});
test("unapproved centers and attendance reject signup without writes", async () => {
  const { db, service } = fixture(); db.Partnerships[0].fields.Status = ["Submitted"];
  await assert.rejects(service.startProject("recPerson", "recActivity")); assert.equal(db.Projects.length, 0);
  db.Partnerships[0].fields.Status = ["Accepted"]; db.Activities[0].fields.Type = "Attendance";
  await assert.rejects(service.startProject("recPerson", "recActivity")); assert.equal(db.Projects.length, 0);
});
test("participation service days use service confirmation instead of kit shipping", async () => {
  const { db, service } = fixture();
  db.Activities[0].fields.Type = "Participation"; db.Activities[0].fields.Category = "Other";
  const project = await service.startProject("recPerson", "recActivity");
  assert.equal(project.category, "Service Day"); assert.equal(project.minimum, 1);
  await service.editProject("recPerson", project.id, { action: "submit", work: "Helped at center", quantity: 1, requestedHours: 2, method: "Service confirmation", tracking: "", confirmation: "Center staff confirmed two hours", reflection: "" });
  assert.equal(db.Projects[0].fields["Action State"], "Submitted");
});
const draft = { action: "submit", work: "Completed kits", quantity: 30, requestedHours: 10, method: "Shipped", tracking: "Carrier 123", confirmation: "", reflection: "I learned how to organize supplies" };
test("ownership, evidence validation and submitted draft locking", async () => {
  const { db, service } = fixture(); const p = await service.startProject("recPerson", "recActivity");
  await assert.rejects(service.editProject("recOther", p.id, draft));
  await assert.rejects(service.editProject("recPerson", p.id, draft)); // missing photo
  db.Projects[0].fields["Item Photos"] = [{ url: "https://example.org/item.jpg", filename: "item.jpg" }];
  await service.editProject("recPerson", p.id, draft);
  assert.equal(db.Submissions.length, 1); assert.equal(db.Projects[0].fields["Action State"], "Submitted");
  await assert.rejects(service.editProject("recPerson", p.id, { ...draft, action: "save", work: "Changed" }));
  assert.ok(db.Submissions[0].fields.Content.includes("Completed kits"));
});
test("director verification sends Hours for review without automatically awarding credit", async () => {
  const { db, service } = fixture(); const p = await service.startProject("recPerson", "recActivity");
  db.Projects[0].fields["Item Photos"] = [{ url: "https://example.org/item.jpg", filename: "item.jpg" }];
  await service.editProject("recPerson", p.id, draft);
  await assert.rejects(service.reviewProject("recPerson", p.id, "approve-work", "Approved", 30));
  await service.reviewProject("recDirector", p.id, "approve-work", "Work meets requirements", 30);
  assert.equal(db.Hours.length, 0);
  await service.reviewProject("recDirector", p.id, "complete", "Center confirmed receipt", 30);
  assert.equal(db.Projects[0].fields["Action State"], "Completed");
  assert.equal(db.Hours.length, 1); assert.equal(db.Hours[0].fields.Status, "Submitted");
  assert.equal(db.Hours[0].fields["Requested Hours"], 10);
  await assert.rejects(service.reviewProject("recDirector", p.id, "complete", "Again", 30)); assert.equal(db.Hours.length, 1);
});
test("revision keeps earlier text and attachments as separate snapshots", async () => {
  const { db, service } = fixture(); const p = await service.startProject("recPerson", "recActivity");
  db.Projects[0].fields["Item Photos"] = [{ url: "https://example.org/item.jpg", filename: "item.jpg" }];
  await service.editProject("recPerson", p.id, draft);
  await service.reviewProject("recDirector", p.id, "request-changes", "Please add detail", 0);
  await service.editProject("recPerson", p.id, { ...draft, work: "Revised kits description" });
  assert.equal(db.Submissions.length, 2); assert.ok(db.Submissions[0].fields.Content.includes("Completed kits")); assert.ok(db.Submissions[1].fields.Content.includes("Revised kits description"));
});
