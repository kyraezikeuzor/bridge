/**
 * Reconcile People + People History against accepted applications.
 *
 * Context: createPersonFromApplication used to write "Status" to People, which
 * is a computed field. Airtable rejected the whole create with a 422, and
 * because runApproveFollowup only logs that failure, the applicant received a
 * welcome email but never appeared on the roster — and because the person
 * create threw first, their History row was never written either.
 *
 *   npx tsx scripts/backfill-people.ts                    # dry run, writes nothing
 *   npx tsx scripts/backfill-people.ts --send             # apply
 *   npx tsx scripts/backfill-people.ts --send --limit 1   # canary first
 *
 * If a run dies between creating a Person and creating their History row, that
 * person is no longer "orphaned" and a plain re-run skips them. Re-run with
 * --include-missing-history to sweep those up.
 *
 * Two passes:
 *   1. Orphaned applications — ensure a Person exists, then ensure a History
 *      row exists and points at that Person.
 *   2. Dangling History — rows with no Linked Person that can be resolved to a
 *      Person through their application's email.
 *
 * Every step checks before it writes, so re-running after a partial or failed
 * run is safe and will not duplicate records.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

/** Airtable allows 5 requests/sec per base. */
const WRITE_INTERVAL_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--send");
  const limitFlag = args.indexOf("--limit");
  const limit =
    limitFlag !== -1 ? Number(args[limitFlag + 1]) || undefined : undefined;
  /** Also repair people whose History row is missing (e.g. after a half-run). */
  const includeMissingHistory = args.includes("--include-missing-history");

  const {
    fetchAllApplications,
    fetchAllPeopleHistory,
    createPersonFromApplication,
    createPeopleHistoryForApplication,
    linkPersonToHistory,
    getPersonByEmailDirect,
  } = await import("../src/lib/airtable");
  const { getAllPeople } = await import("../src/lib/peopleCache");

  const [apps, people, history] = await Promise.all([
    fetchAllApplications(),
    getAllPeople(),
    fetchAllPeopleHistory(),
  ]);

  const personIdByEmail = new Map(
    people
      .map((p) => [(p.fields.Email ?? "").trim().toLowerCase(), p.id] as const)
      .filter(([email]) => email)
  );
  const appById = new Map(apps.map((a) => [a.id, a]));

  /** History rows indexed by the application they belong to. */
  const historyByApp = new Map<string, typeof history>();
  for (const h of history) {
    for (const appId of h.applicationIds) {
      if (!historyByApp.has(appId)) historyByApp.set(appId, []);
      historyByApp.get(appId)!.push(h);
    }
  }

  // ——— Pass 1: applications accepted but missing from the roster ———

  const appsWithHistory = new Set(history.flatMap((h) => h.applicationIds));

  const seen = new Set<string>();
  let orphaned = apps.filter((a) => {
    if (a.status !== "Accepted" || !a.email) return false;
    const email = a.email.toLowerCase();
    if (seen.has(email)) return false;

    const missingPerson = !personIdByEmail.has(email);

    // A person can exist while their History row does not, when a run of this
    // script died between the two writes. Repairing that is opt-in AND scoped
    // to applications this bug actually broke — identified by the failure note
    // runApproveFollowup wrote. Some accepted applications legitimately have no
    // History row and predate this bug; inventing a stint for them backdated to
    // today is a silent falsification of their record, not a repair.
    const brokenByThisBug = (a.fields["Onboarding Details"] ?? "").includes(
      "History/Person sync failed"
    );
    const missingHistory =
      !missingPerson && !appsWithHistory.has(a.id) && brokenByThisBug;
    if (!missingPerson && !(missingHistory && includeMissingHistory)) {
      return false;
    }

    seen.add(email);
    return true;
  });

  if (limit !== undefined) orphaned = orphaned.slice(0, limit);

  console.log(`\n=== Pass 1: ${orphaned.length} orphaned application(s) ===\n`);

  let created = 0;
  let linked = 0;
  let failed = 0;

  for (let i = 0; i < orphaned.length; i += 1) {
    const app = orphaned[i];
    const label = `${app.email} (${app.firstName} ${app.lastName})`;
    const existingHistory = historyByApp.get(app.id) ?? [];
    const historyNeedingLink = existingHistory.filter(
      (h) => h.personIds.length === 0
    );

    const plan = [
      personIdByEmail.has(app.email.toLowerCase())
        ? "Person exists"
        : "create Person",
      existingHistory.length === 0
        ? "create History"
        : historyNeedingLink.length > 0
          ? `link ${historyNeedingLink.length} existing History row(s)`
          : "History already linked — skip",
    ].join(" + ");

    if (!live) {
      console.log(`  would ${plan.padEnd(46)} ${label}`);
      continue;
    }

    try {
      // Re-check against Airtable rather than the snapshot, so a re-run after a
      // partial failure reuses the person instead of creating a duplicate.
      const already = await getPersonByEmailDirect(app.email);
      const person = already ?? (await createPersonFromApplication(app));
      if (!already) await sleep(WRITE_INTERVAL_MS);

      if (existingHistory.length === 0) {
        await createPeopleHistoryForApplication({
          personId: person.id,
          applicationId: app.id,
          role: app.role || "Volunteer",
          tracks: app.tracks,
          school: app.school,
          state: app.state,
          country: app.country,
          // When they were actually accepted — not when this backfill ran.
          startDate: app.fields["Review Date"],
        });
        console.log(`  created Person+History  ${label} → ${person.id}`);
        created += 1;
      } else if (historyNeedingLink.length > 0) {
        for (const h of historyNeedingLink) {
          await linkPersonToHistory(h.id, person.id);
          await sleep(WRITE_INTERVAL_MS);
        }
        console.log(
          `  created Person, linked ${historyNeedingLink.length} History  ${label} → ${person.id}`
        );
        created += 1;
        linked += historyNeedingLink.length;
      } else {
        console.log(`  created Person (History already linked)  ${label}`);
        created += 1;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED  ${label}: ${detail}`);
      failed += 1;
    }

    if (i < orphaned.length - 1) await sleep(WRITE_INTERVAL_MS);
  }

  // ——— Pass 2: History rows that never got attached to a person ———

  const dangling = history.filter((h) => h.personIds.length === 0);
  console.log(
    `\n=== Pass 2: ${dangling.length} History row(s) with no Linked Person ===\n`
  );

  let repaired = 0;
  const unresolvable: string[] = [];

  for (const h of dangling) {
    const app = h.applicationIds.map((id) => appById.get(id)).find(Boolean);
    const email = app?.email?.trim().toLowerCase() ?? "";
    const personId = email ? personIdByEmail.get(email) : undefined;

    if (!personId) {
      const why = !app
        ? "no linked application"
        : !email
          ? "application has no email"
          : "no People record for that email";
      unresolvable.push(`${h.id} (${h.role ?? "no role"}) — ${why}`);
      continue;
    }

    if (!live) {
      console.log(`  would link  ${h.id} → ${personId} (${email})`);
      continue;
    }

    try {
      await linkPersonToHistory(h.id, personId);
      console.log(`  linked  ${h.id} → ${personId} (${email})`);
      repaired += 1;
      await sleep(WRITE_INTERVAL_MS);
    } catch (err) {
      console.error(`  FAILED  ${h.id}: ${err}`);
      failed += 1;
    }
  }

  if (unresolvable.length) {
    console.log(`\n  needs manual attention (${unresolvable.length}):`);
    unresolvable.forEach((u) => console.log(`    ${u}`));
  }

  console.log(
    live
      ? `\nDone — ${created} people created, ${linked + repaired} history rows linked, ${failed} failed.`
      : "\nDry run — nothing was written. Re-run with --send."
  );
}

main().catch((error) => {
  console.error("\nbackfill-people failed:", error);
  process.exit(1);
});
