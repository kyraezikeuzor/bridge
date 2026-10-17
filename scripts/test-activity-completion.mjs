import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, Map, Set, Promise, Error, Number, RegExp, Request, Response, File,
    console: { error() {} },
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected runtime dependency: ${name}`);
    },
  }, { filename: path });
  return module.exports;
}

const rules = load("src/lib/activityCompletion.ts");
const { hasFinalizedHoursWork } = load("src/lib/airtable/hours-work.ts", {
  "./client": {}, "./hours": {}, "../workReview": {}, "./submissions": {},
});
test("letters must be complete groups of three and hours scale per batch", () => {
  assert.equal(rules.letterBatchError(["one", "two", "three"]), null);
  assert.equal(rules.letterBatchError(Array(6).fill("letter")), null);
  assert.match(rules.letterBatchError(["one", "two"]), /groups of three/);
  assert.match(rules.letterBatchError(["one", "two", " "]), /must contain text/);
  assert.match(rules.letterBatchError(Array(33).fill("letter")), /up to 30/);
  assert.equal(rules.validCompletedDate("2026-02-30"), false);
  assert.equal(rules.validCompletedDate("2020-02-29"), true);
  assert.equal(rules.validCompletedDate("2999-01-01"), false);
  assert.equal(rules.validBatchId("short"), false);
  assert.equal(rules.validBatchId("12345678-1234-1234-1234-123456789abc"), true);
});

const claim = {
  id: "claim", personId: "person", activityId: "activity", isLegacySignUp: false, status: "Claimed",
  activity: { id: "activity", completionWorkflow: "Letters", hoursValue: 2 },
};
function route({ sessionPerson = "person", claims = [claim], onReserve = () => {}, onUpdate = () => {}, onCreate = () => ({ id: "hours", status: "Submitted" }), onGetRecord = async () => null, onUpload = async () => {}, onFetchHourById = async () => null } = {}) {
  return load("src/app/api/person-activities/[claimId]/complete/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/auth": { auth: async () => sessionPerson ? { user: { personId: sessionPerson } } : null },
    "@/lib/activitiesCache": { getPersonActivities: async () => claims },
    "@/lib/airtable/hours-work": {
      coalesceHoursWork: async (_key, action) => action(), hasFinalizedHoursWork, createWorkHours: async (input) => onCreate(input),
    },
    "@/lib/airtable/client": {
      asStringArray: (value) => Array.isArray(value) ? value : [],
      reserveRecord: async (table, field, value) => onReserve(table, field, value) ?? { id: table === "Hours" ? "hours" : `submission-${value.split(":").at(-1)}`, fields: table === "Hours" ? { Status: "Submitted", "Work Reference": value } : {} },
      updateRecord: async (table, id, fields) => { onUpdate(table, id, fields); return { id, fields }; },
      getRecord: onGetRecord,
    },
    "@/lib/airtable/hours": { uploadHoursProof: onUpload, fetchHoursRequestById: onFetchHourById },
    "@/lib/activityCompletion": rules,
    "@/lib/hoursCache": { refreshHoursCache: async () => {} },
  });
}
function letterRequest(letters = ["one", "two", "three"], mode = "Letters") {
  return new Request("http://localhost/api/person-activities/claim/complete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId: "12345678-1234-1234-1234-123456789abc", mode, letters, completedDate: "2020-02-29", confirmation: "true" }),
  });
}
const context = { params: { claimId: "claim" } };

test("completion requires sign-in and claim ownership before any write", async () => {
  let writes = 0;
  const loggedOut = route({ sessionPerson: "", onReserve: () => writes++ });
  assert.equal((await loggedOut.POST(letterRequest(), context)).status, 401);
  const otherOwner = route({ claims: [], onReserve: () => writes++ });
  assert.equal((await otherOwner.POST(letterRequest(), context)).status, 404);
  assert.equal(writes, 0);
});

test("invalid letter count and mismatched workflow never reserve a batch", async () => {
  let writes = 0;
  const api = route({ onReserve: () => writes++ });
  assert.equal((await api.POST(letterRequest(["one", "two"]), context)).status, 422);
  assert.equal((await api.POST(letterRequest(undefined, "Photo proof"), context)).status, 422);
  assert.equal(writes, 0);
});

test("six typed letters create six linked evidence records and request two hours", async () => {
  const saved = [];
  let finalized;
  const api = route({
    onUpdate: (table, id, fields) => saved.push({ table, id, fields }),
    onCreate: (input) => { finalized = input; return { id: "hours", status: "Submitted" }; },
  });
  const response = await api.POST(letterRequest(Array(6).fill("  Dear neighbor  ")), context);
  assert.equal(response.status, 200);
  assert.equal(saved.filter((row) => row.table === "Submissions").length, 6);
  assert.equal(saved.find((row) => row.table === "Hours").fields["Linked Claim"][0], "claim");
  assert.equal(saved.filter((row) => row.table === "Submissions")[0].fields.Content, "Dear neighbor");
  assert.equal(finalized.quantity, 6);
  assert.equal(finalized.requestedHours, 2);
  assert.equal(finalized.workType, "Letter Writing");
  assert.equal(finalized.submissionIds.length, 6);
});

test("photo proof uploads pictures and uses the activity's configured hours", async () => {
  const photoClaim = { ...claim, activity: { ...claim.activity, completionWorkflow: "Photo proof", hoursValue: 2.5 } };
  const uploads = [];
  let finalized;
  const api = route({
    claims: [photoClaim],
    onUpload: async (input) => { uploads.push(input.filename); },
    onGetRecord: async () => ({ fields: { Proof: uploads.map((filename) => ({ filename, url: "https://example.org/picture" })) } }),
    onCreate: (input) => { finalized = input; return { id: "hours", status: "Submitted" }; },
  });
  const form = new FormData();
  form.set("batchId", "12345678-1234-1234-1234-123456789abc");
  form.set("mode", "Photo proof");
  form.set("completedDate", "2020-02-29");
  form.set("confirmation", "true");
  form.append("proof", new File(["picture"], "proof.png", { type: "image/png" }));
  const response = await api.POST(new Request("http://localhost/api/person-activities/claim/complete", { method: "POST", body: form }), context);
  assert.equal(response.status, 200);
  assert.equal(uploads.length, 1);
  assert.equal(finalized.requestedHours, 2.5);
  assert.equal(finalized.workType, "Photo Proof");
});

test("retrying a submitted batch returns its receipt without changing evidence", async () => {
  let mutations = 0;
  const receipt = { id: "hours", status: "Submitted", workReference: "BridgeBatch:claim:12345678-1234-1234-1234-123456789abc" };
  const api = route({
    onReserve: (table) => table === "Hours" ? { id: "hours", fields: { Status: "Submitted", "Submitted Date": "2026-10-15", "Linked Person": ["person"], "Linked Activity": ["activity"], "Linked Claim": ["claim"] } } : undefined,
    onFetchHourById: async () => ({ ...receipt, personIds: ["person"], linkedActivityIds: ["activity"], claimId: "claim" }),
    onUpdate: () => mutations++,
    onCreate: () => { mutations++; return receipt; },
  });
  const response = await api.POST(letterRequest(), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).hours.id, "hours");
  assert.equal(mutations, 0);
});

test("new director-created activities select completion mode without creating projects", async () => {
  let saved;
  const api = load("src/app/api/admin/activities/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/airtable/activities": { createProjectActivity: async (fields) => { saved = fields; return { id: "activity", name: fields["Activity Name"] }; } },
    "@/lib/airtable/client": { asStringArray: (value) => Array.isArray(value) ? value : [], getRecord: async () => ({ fields: { Status: ["Accepted"] } }) },
    "@/lib/activitiesCache": { refreshActivitiesCache: async () => {} },
    "@/lib/activityTemplates": { PROJECT_ACTIVITY_TEMPLATES: { Letters: { type: "Submission", minimum: 1, instructions: "Write letters", guideUrl: "" } } },
    "@/lib/directorAuth": { requireAdminDirector: async () => ({ personId: "director" }) },
  });
  const request = new Request("http://localhost/api/admin/activities", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Write letters", track: "Education", category: "Letters", description: "Description", instructions: "Instructions", centerId: "recABCDE", startDate: "2026-10-01", endDate: "2026-11-30", capacity: 5, hoursValue: 0 }),
  });
  const response = await api.POST(request);
  assert.equal(response.status, 201);
  assert.equal(saved["Completion Workflow"], "Letters");
  assert.equal(saved["Creates Project"], false);
  assert.equal(saved["Project Minimum Quantity"], undefined);
});
