/**
 * Repair People records whose Email domain is an unambiguous misspelling of a
 * domain used by hundreds of other volunteers (gmail.con, gamil.com, …).
 *
 * These addresses bounce, which means those volunteers receive nothing from
 * Bridge at all — no hours notifications, no acceptance mail, and no magic
 * link, so they cannot even sign in.
 *
 *   npx tsx scripts/fix-typo-emails.ts          # dry run, writes nothing
 *   npx tsx scripts/fix-typo-emails.ts --send   # apply
 *
 * Only the domain is rewritten; the local part is never touched. Any
 * correction that would collide with an existing People record is skipped
 * rather than merged, because two records claiming one address is a worse
 * problem than one unreachable record.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

/** Misspelling → what it is obviously meant to be. */
const DOMAIN_CORRECTIONS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmil.com": "gmail.com",
  "gmzil.com": "gmail.com",
  "gmail.fom": "gmail.com",
  "gmail.comc": "gmail.com",
  "gmail.come": "gmail.com",
  "gmail.comk": "gmail.com",
  "gmail.coml": "gmail.com",
  "gmail.comt": "gmail.com",
  "gmail.comiy": "gmail.com",
  "icloud.con": "icloud.com",
};

const WRITE_INTERVAL_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const live = process.argv.includes("--send");

  const { getAllPeople } = await import("../src/lib/peopleCache");
  const people = await getAllPeople();

  const byEmail = new Map<string, string>();
  for (const p of people) {
    const e = (p.fields.Email ?? "").trim().toLowerCase();
    if (e) byEmail.set(e, p.id);
  }

  type Fix = {
    id: string;
    from: string;
    to: string;
    name: string;
    collidesWith?: string;
  };

  const fixes: Fix[] = [];
  for (const p of people) {
    const email = (p.fields.Email ?? "").trim();
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const corrected = DOMAIN_CORRECTIONS[domain];
    if (!corrected) continue;

    const to = `${email.split("@")[0]}@${corrected}`;
    fixes.push({
      id: p.id,
      from: email,
      to,
      name: `${p.fields["First Name"] ?? ""} ${p.fields["Last Name"] ?? ""}`.trim(),
      collidesWith: byEmail.get(to.toLowerCase()),
    });
  }

  const safe = fixes.filter((f) => !f.collidesWith);
  const colliding = fixes.filter((f) => f.collidesWith);

  console.log(`\n${fixes.length} record(s) with a correctable domain\n`);
  for (const f of safe) {
    console.log(`  ${f.from}`);
    console.log(`    → ${f.to}   (${f.name || "no name"})`);
  }

  if (colliding.length) {
    console.log(`\n  SKIPPED — corrected address already belongs to another record (${colliding.length}):`);
    colliding.forEach((f) =>
      console.log(`    ${f.from} → ${f.to} is already People ${f.collidesWith}`)
    );
  }

  if (!live) {
    console.log(`\nDry run — nothing written. ${safe.length} would be corrected.`);
    return;
  }

  const key = process.env.AIRTABLE_API_KEY;
  const base = process.env.AIRTABLE_BASE_ID;
  let ok = 0;
  let failed = 0;

  console.log("");
  for (const f of safe) {
    const res = await fetch(
      `https://api.airtable.com/v0/${base}/People/${f.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { Email: f.to } }),
      }
    );
    if (!res.ok) {
      console.error(`  FAILED ${f.from}: ${res.status} ${(await res.text()).slice(0, 160)}`);
      failed += 1;
    } else {
      console.log(`  fixed  ${f.from} → ${f.to}`);
      ok += 1;
    }
    await sleep(WRITE_INTERVAL_MS);
  }

  console.log(`\nDone — ${ok} corrected, ${failed} failed, ${colliding.length} skipped as collisions.`);
}

main().catch((error) => {
  console.error("\nfix-typo-emails failed:", error);
  process.exit(1);
});
