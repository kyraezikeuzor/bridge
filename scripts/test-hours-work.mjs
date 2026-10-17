import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { createHmac, timingSafeEqual } from "node:crypto";

// Run focused TypeScript module tests with existing dependencies, no new framework.
const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, Map, Set, Promise, Error, Buffer, URL, Number,
    console: { log() {}, error() {} },
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected runtime dependency: ${name}`);
    },
    ...globals,
  }, { filename: path });
  return module.exports;
}
const rules = load("src/lib/workReview.ts");
const client = {
  asStringArray: (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [],
  formatTrack: (v) => Array.isArray(v) ? v.join(", ") : v || "",
  escapeFormulaString: (v) => v.replaceAll("'", "\\'"),
};
const hours = load("src/lib/airtable/hours.ts", {
  "./client": client, "./people": {}, "./activities": {}, "./submissions": {},
});
const activity = {
  id: "activity", name: "Letters", platform: "Bridge", type: "Submission",
  hoursValue: 3, submissionTarget: 2, submissionFormat: "Text", track: "Education",
};
const claim = { id: "claim", activityId: "activity", isLegacySignUp: false };
function work(mocks = {}) {
  return load("src/lib/airtable/hours-work.ts", {
    "./client": { ...client, ...mocks },
    "./hours": { ...hours, fetchHoursForPerson: async () => [] },
    "../workReview": rules,
    "./submissions": { fetchSubmissionsForClaim: async () => [{ id: "old" }, { id: "revised" }] },
  });
}

test("rejection starts fresh drafts without deleting or recycling old evidence", async () => {
  const api = work();
  const history = [{ status: "Rejected", submissionIds: ["old"], submissions: [{ id: "old" }] }];
  const drafts = await api.fetchWorkingSubmissionsForClaim("person", claim, history);
  assert.equal(drafts.length, 1); assert.equal(drafts[0].id, "revised");
  assert.equal(history[0].submissions[0].id, "old");
  const submitted = await api.fetchWorkingSubmissionsForClaim("person", claim, [{ ...history[0], status: "Submitted" }]);
  assert.equal(submitted[0].id, "old");
});

test("Hours review status is the completion source, including rejection", () => {
  assert.equal(rules.completionStateFromHours("Claimed", []), "In progress");
  assert.equal(rules.completionStateFromHours("Claimed", [{ status: "Submitted" }]), "Submitted");
  assert.equal(rules.completionStateFromHours("Completed", [{ status: "Rejected" }]), "In progress");
  assert.equal(rules.completionStateFromHours("Claimed", [{ status: "Rejected" }, { status: "Approved" }]), "Completed");
  assert.equal(rules.completionStateFromHours("Completed", []), "Completed");
  assert.equal(rules.completionStateFromHours("Claimed", [{ status: "Draft" }]), "In progress");
});

test("work remains isolated to its physical claim, with bounded legacy fallback", () => {
  assert.equal(rules.hoursBelongsToClaim({ claimId: "claim", linkedActivityIds: ["activity"] }, claim), true);
  assert.equal(rules.hoursBelongsToClaim({ claimId: "other", linkedActivityIds: ["activity"] }, claim), false);
  assert.equal(rules.hoursBelongsToClaim({ claimId: null, linkedActivityIds: ["activity"] }, claim), false);
  assert.equal(rules.hoursBelongsToClaim({ claimId: null, linkedActivityIds: ["activity"] }, { ...claim, isLegacySignUp: true }), true);
  assert.equal(rules.hoursBelongsToClaim({ claimId: "other", linkedActivityIds: ["activity"] }, { ...claim, isLegacySignUp: true }), false);
});

test("resubmission gets a new stable retry key and leaves rejected history intact", () => {
  assert.equal(rules.nextWorkReference("claim", []), "Bridge:claim:initial");
  const previous = [{ id: "rejected", status: "Rejected", submittedAt: "2026-09-15" }];
  assert.equal(rules.nextWorkReference("claim", previous), "Bridge:claim:rejected");
  assert.equal(rules.nextWorkReference("claim", previous), "Bridge:claim:rejected");
  assert.equal(previous[0].status, "Rejected");
});

test("submission requirements enforce exact target, format, and nonempty evidence", () => {
  const text = { content: "A letter", files: [] };
  assert.equal(rules.submissionValidationError(2, "Text", [text, text]), null);
  assert.ok(rules.submissionValidationError(2, "Text", [text]));
  assert.ok(rules.submissionValidationError(1, "Text", [text, text]));
  assert.ok(rules.submissionValidationError(null, "Text", []));
  assert.ok(rules.submissionValidationError(1, "File", [{ content: null, files: [] }]));
  assert.equal(rules.submissionValidationError(1, "File", [{ content: null, files: [{}] }]), null);
  assert.ok(rules.submissionValidationError(1, "Text", [{ content: "   ", files: [] }]));
  assert.ok(rules.submissionValidationError(1, null, [text]));
});

test("Hours directly owns dates, proof, requested amount, and reviewer assignment", () => {
  const row = hours.mapHoursRecord({ id: "hours", createdTime: "2026-09-15", fields: {
    Status: "Approved", Hours: 1.5, "Requested Hours": 3, "Linked Claim": ["claim"],
    "Started Date": "2026-09-01", "Completed Date": "2026-09-05T14:00:00Z",
    "Proof Link": "https://example.com/proof", "Linked Assignee": ["reviewer"],
  } });
  assert.equal(row.hoursRequested, 1.5);
  assert.equal(row.requestedHours, 3);
  assert.equal(row.startDate, "2026-09-01");
  assert.equal(row.endDate, "2026-09-05T14:00:00Z");
  assert.equal(row.claimId, "claim");
  assert.equal(row.assigneeIds[0], "reviewer");
  assert.equal(row.proofUrl, "https://example.com/proof");
});

test("only approved Hours contributes to credit, including zero-hour approvals", () => {
  const records = [
    { status: "Approved", hoursRequested: 2.5, date: "2026-09-01" },
    { status: "Approved", hoursRequested: 0, date: "2026-09-01" },
    { status: "Rejected", hoursRequested: 9, date: "2026-09-01" },
    { status: "Submitted", hoursRequested: 9, date: "2026-09-01" },
  ];
  const summary = hours.summarizePersonHours(records);
  assert.equal(summary.lifetimeTotal, 2.5);
  assert.equal(summary.pendingReview, 1);
});

test("finalization writes one direct Hours record with the exact evidence snapshot", async () => {
  let writes = 0, fields;
  const api = work({
    reserveRecord: async (table, field, value) => {
      assert.equal(table, "Hours"); assert.equal(field, "Work Reference");
      return { id: "hours", createdTime: "2026-09-15", fields: { [field]: value } };
    },
    updateRecord: async (table, id, next) => {
      assert.equal(table, "Hours"); assert.equal(id, "hours"); writes++; fields = next;
      return { id, fields: next };
    },
  });
  const row = await api.createWorkHours({ personId: "person", claim, activity, reference: "Bridge:claim:initial", submissionIds: ["one", "two"], quantity: 2, ownershipAgreement: true });
  assert.equal(writes, 1); assert.equal(row.status, "Submitted");
  assert.equal(fields["Linked Claim"][0], "claim");
  assert.equal(fields["Linked Submissions"].join(","), "one,two");
  assert.equal(fields["Requested Hours"], 3); assert.equal(fields.Hours, 3);
  assert.equal(fields["Ownership Agreement"], true);
  assert.equal("Track" in fields, false); // Track is computed in the live base.
  assert.equal("Platform" in fields, false); // Neither field exists in the live Hours table.
  assert.equal("Work Type" in fields, false);
});

test("Airtable's Submitted default on a new reservation is not treated as finished work", async () => {
  let fields;
  const api = work({
    reserveRecord: async (_table, field, value) => ({ id: "hours", createdTime: "2026-10-15", fields: { [field]: value, Status: "Submitted" } }),
    updateRecord: async (_table, id, next) => { fields = next; return { id, fields: next }; },
  });
  const row = await api.createWorkHours({ personId: "person", claim, activity, reference: "BridgeBatch:claim:new", submissionIds: ["one", "two", "three"], quantity: 3, requestedHours: 1 });
  assert.equal(row.status, "Submitted");
  assert.equal(fields["Linked Person"][0], "person");
  assert.equal(fields["Linked Claim"][0], "claim");
  assert.equal(fields["Linked Submissions"].length, 3);
  assert.equal(fields["Requested Hours"], 1);
  assert.equal(api.hasFinalizedHoursWork({ Status: "Submitted", "Work Reference": "BridgeBatch:claim:new" }), false);
  assert.equal(api.hasFinalizedHoursWork({ Status: "Submitted", "Work Reference": "BridgeBatch:claim:new", "Submitted Date": "2026-10-15T12:00:00Z" }), true);
  assert.equal(hours.mapHoursRecord({ id: "incomplete", createdTime: "2026-10-15", fields: { Status: "Submitted", "Work Reference": "BridgeBatch:claim:new" } }).status, "Draft");
  assert.equal(hours.mapHoursRecord({ id: "complete", createdTime: "2026-10-15", fields: { Status: "Submitted", "Work Reference": "BridgeBatch:claim:new", "Submitted Date": "2026-10-15T12:00:00Z" } }).status, "Submitted");
  assert.equal(hours.mapHoursRecord({ id: "letters", createdTime: "2026-10-15", fields: { "Work Reference": "BridgeBatch:claim:new", "Linked Submissions": ["one"] } }).workType, "Letter Writing");
  assert.equal(hours.mapHoursRecord({ id: "photos", createdTime: "2026-10-15", fields: { "Work Reference": "BridgeBatch:claim:new" } }).workType, "Photo Proof");
});

test("retry never resets an approved Hours record or its zero-hour award", async () => {
  const api = work({
    reserveRecord: async () => ({ id: "hours", createdTime: "2026-09-15", fields: { Status: "Approved", Hours: 0, "Linked Person": ["person"], "Linked Activity": ["activity"] } }),
    updateRecord: async () => { throw new Error("Reviewed Hours must never be overwritten"); },
  });
  const row = await api.createWorkHours({ personId: "person", claim, activity, reference: "Bridge:claim:initial" });
  assert.equal(row.status, "Approved"); assert.equal(row.hoursRequested, 0);
});

test("signed external work awards verified hours rather than blindly using activity value", async () => {
  const api = work({
    reserveRecord: async () => ({ id: "hours", createdTime: "2026-09-15", fields: {} }),
    updateRecord: async (_, id, fields) => ({ id, fields }),
  });
  const row = await api.createWorkHours({ personId: "person", claim, activity: { ...activity, platform: "Monsoon" }, reference: "Monsoon:event", externalReference: "Monsoon:event", verifiedHours: 2.5, approved: true });
  assert.equal(row.status, "Approved"); assert.equal(row.hoursRequested, 2.5);
  assert.equal(row.verifiedHours, 2.5); assert.equal(row.calculatedHours, 3);
});

test("a work reference cannot be reused for another volunteer", async () => {
  const api = work({ reserveRecord: async () => ({ id: "hours", createdTime: "2026-09-15", fields: { Status: "Approved", "Linked Person": ["other"], "Linked Activity": ["activity"] } }) });
  await assert.rejects(api.createWorkHours({ personId: "person", claim, activity, reference: "Bridge:claim:initial" }), /another person/);
});

test("invalid configured hours fails before creating a work reservation", async () => {
  let reservations = 0;
  const api = work({ reserveRecord: async () => { reservations++; throw new Error("must not reserve"); } });
  await assert.rejects(api.createWorkHours({ personId: "person", claim, activity: { ...activity, hoursValue: NaN }, reference: "Bridge:claim:initial" }), /Invalid activity hours/);
  assert.equal(reservations, 0);
});

test("concurrent finalizations coalesce and conflicting reviews serialize", async () => {
  const api = work(); let calls = 0;
  const action = async () => { calls++; await Promise.resolve(); return { id: "hours" }; };
  const results = await Promise.all([api.coalesceHoursWork("claim", action), api.coalesceHoursWork("claim", action)]);
  assert.equal(calls, 1); assert.equal(results[0].id, results[1].id);
  const order = [];
  await Promise.all([
    api.serializeHoursReview("hours", async () => { order.push("approve-start"); await Promise.resolve(); order.push("approve-end"); }),
    api.serializeHoursReview("hours", async () => { order.push("reject-start"); }),
  ]);
  assert.equal(order.join(","), "approve-start,approve-end,reject-start");
});

test("review writes the same Hours record and preserves original requested hours", async () => {
  let written;
  const api = load("src/lib/airtable/hours.ts", {
    "./client": { ...client, getRecord: async () => ({ id: "hours", fields: { Status: "Submitted", Hours: 3 } }), updateRecord: async (_, id, fields) => { written = fields; return { id, fields }; } },
    "./people": {}, "./activities": {}, "./submissions": {},
  });
  await api.updateHoursStatus("hours", "Approved", { hours: 0, reviewerId: "reviewer", reviewNote: "Verified" });
  assert.equal(written.Status, "Approved"); assert.equal(written.Hours, 0);
  assert.equal(written["Requested Hours"], 3); assert.equal(written["Linked Reviewer"][0], "reviewer");
  assert.equal(written["Review Notes"], "Verified");
});

test("already-reviewed Hours rejects a second mutation", async () => {
  const api = load("src/lib/airtable/hours.ts", {
    "./client": { ...client, getRecord: async () => ({ fields: { Status: "Rejected", Hours: 3 } }), updateRecord: async () => { throw new Error("must not write"); } },
    "./people": {}, "./activities": {}, "./submissions": {},
  });
  await assert.rejects(api.updateHoursStatus("hours", "Approved"), /already been reviewed/);
});

const responseAPI = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
const requestBody = (body) => ({ headers: { get: () => "application/json" }, json: async () => body });

test("viewer finalization and retries return Hours, never Contributions", async () => {
  let previous = [], creates = 0;
  const submissions = [{ id: "one", content: "One", files: [] }, { id: "two", content: "Two", files: [] }];
  const route = load("src/app/api/person-activities/[claimId]/route.ts", {
    "next/server": responseAPI,
    "@/auth": { auth: async () => ({ user: { personId: "person" } }) },
    "@/lib/activitiesCache": { getPersonActivities: async () => [{ ...claim, status: "Claimed", activity }] },
    "@/lib/airtable": {
      fetchHoursForClaim: async () => previous,
      fetchWorkingSubmissionsForClaim: async () => submissions,
      coalesceHoursWork: async (_, action) => action(),
      createWorkHours: async (input) => {
        creates++; assert.equal(input.submissionIds.join(","), "one,two");
        const row = { id: "hours", status: "Submitted", submittedAt: "2026-09-15" };
        previous = [row]; return row;
      },
    },
    "@/lib/workReview": rules,
    "@/lib/hoursCache": { refreshHoursCache: async () => {} },
  });
  const params = { params: { claimId: "claim" } };
  const denied = await route.POST(requestBody({ action: "finalize-submissions" }), params);
  assert.equal(denied.status, 422); assert.equal(creates, 0);
  const first = await route.POST(requestBody({ action: "finalize-submissions", ownershipAgreement: "true" }), params);
  const retry = await route.POST(requestBody({ action: "finalize-submissions", ownershipAgreement: "true" }), params);
  assert.equal(first.body.hours.id, "hours"); assert.equal(retry.body.hours.id, "hours");
  assert.equal(creates, 1); assert.equal("contribution" in first.body, false);
  const get = await route.GET({}, params);
  assert.equal(get.body.hours.length, 1); assert.equal("contributions" in get.body, false);
  const save = await route.POST(requestBody({ action: "save-submission", content: "New" }), params);
  assert.equal(save.status, 409);
});

test("Hours rejection updates one record and a second conflicting decision is rejected", async () => {
  let writes = 0;
  let failSideEffects = false;
  const row = { id: "hours", status: "Submitted", assigneeIds: [], firstName: "Volunteer", personName: "Volunteer", personIds: ["person"], workReference: "Legacy:old", description: "Work", linkedActivity: null };
  const route = load("src/app/api/hours/review/route.ts", {
    "next/server": responseAPI,
    "@/auth": { auth: async () => ({ user: { personId: "reviewer", role: "Director" } }) },
    "@/lib/airtable": {
      fetchHoursRequestById: async () => row,
      serializeHoursReview: async (_, action) => action(),
      updateHoursStatus: async (id, status) => { assert.equal(id, "hours"); writes++; row.status = status; },
      getPersonById: async () => { if (failSideEffects) throw new Error("Contact service unavailable"); return { fields: {} }; },
    },
    "@/lib/hoursCache": { patchHoursInCache() {}, refreshHoursCache: async () => { if (failSideEffects) throw new Error("Cache refresh unavailable"); } },
    "@/lib/links": { emailLink: () => "https://bridge.example/summary" },
    "@/lib/email": { sendHoursApprovedEmail: async () => {}, sendHoursRejectedEmail: async () => {} },
    "@/lib/reviewAssignee": { resolveReviewerIdentity: async (user) => user, canReviewHoursAssignment: () => true },
    "@/lib/roles": { isLeaderRole: (role) => role === "Director" },
    "@/lib/workReview": rules,
  });
  const rejected = await route.POST(requestBody({ hoursId: "hours", action: "reject", note: "Revise" }));
  assert.equal(rejected.status, 200); assert.equal(row.status, "Rejected");
  const conflict = await route.POST(requestBody({ hoursId: "hours", action: "approve" }));
  assert.equal(conflict.status, 409); assert.equal(writes, 1);
  row.status = "Submitted"; failSideEffects = true;
  const durable = await route.POST(requestBody({ hoursId: "hours", action: "reject" }));
  assert.equal(durable.status, 200); assert.equal(row.status, "Rejected"); assert.equal(writes, 2);
});

test("signed external endpoint validates HMAC and writes direct verified Hours", async () => {
  const secret = "test-only-secret"; let writes = 0;
  const externalActivity = { ...activity, platform: "Monsoon", externalProjectId: "project" };
  const route = load("src/app/api/contributions/external/route.ts", {
    "node:crypto": { createHmac, timingSafeEqual }, "next/server": responseAPI,
    "@/lib/activitiesCache": { getPersonActivities: async () => [{ ...claim, status: "Claimed" }] },
    "@/lib/airtable": {
      getPersonByEmailDirect: async () => ({ id: "person" }), fetchAllActivities: async () => [externalActivity],
      coalesceHoursWork: async (_, action) => action(),
      findHoursByWorkReference: async () => null, findHoursByExternalReference: async () => null,
      createWorkHours: async (input) => { writes++; assert.equal(input.verifiedHours, 2.5); assert.equal(input.approved, true); return { id: "hours", status: "Approved" }; },
    },
    "@/lib/hoursCache": { refreshHoursCache: async () => {} },
  }, { process: { env: { MONSOON_WEBHOOK_SECRET: secret } } });
  const body = JSON.stringify({ eventId: "event", personEmail: "test@example.com", projectId: "project", hours: 2.5 });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  const request = (sig, raw = body) => ({ headers: { get: (name) => name === "x-bridge-timestamp" ? timestamp : name === "x-bridge-signature" ? sig : null }, text: async () => raw });
  const invalid = await route.POST(request("wrong"));
  assert.equal(invalid.status, 401); assert.equal(writes, 0);
  const valid = await route.POST(request(signature));
  assert.equal(valid.status, 200); assert.equal(valid.body.hours.id, "hours"); assert.equal(writes, 1);
  for (const malformed of [null, [], { eventId: "event", personEmail: "test@example.com", projectId: "project", hours: "2.5" }]) {
    const raw = JSON.stringify(malformed);
    const sig = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
    const rejected = await route.POST(request(sig, raw));
    assert.equal(rejected.status, 400); assert.equal(writes, 1);
  }
});

test("middleware permits HMAC endpoints without exposing normal review endpoints", () => {
  const { authConfig } = load("src/auth.config.ts");
  const authorized = (pathname) => authConfig.callbacks.authorized({ auth: null, request: { nextUrl: { pathname } } });
  assert.equal(authorized("/api/hours/external"), true);
  assert.equal(authorized("/api/contributions/external"), true);
  assert.equal(authorized("/api/hours/review"), false);
});
