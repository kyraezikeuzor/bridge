/**
 * Send the Volunteer Roundup to one or more explicit addresses, for checking
 * how the mail actually renders before it goes to the roster.
 *
 * This drives the same lib functions the /api/roundup route uses, so a pass
 * here exercises the real send path rather than a copy of it.
 *
 *   npx tsx scripts/roundup-test.ts you@example.com
 *   npx tsx scripts/roundup-test.ts you@example.com --send
 *
 * Or send to a whole audience instead of explicit addresses:
 *
 *   npx tsx scripts/roundup-test.ts --audience affected
 *   npx tsx scripts/roundup-test.ts --audience affected --send
 *
 * Without --send it is a dry run and nothing leaves the building.
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

/**
 * Durable record of who has already received the roundup.
 *
 * A send interrupted partway (Resend enforces a daily quota) must not
 * re-deliver to everyone when it resumes, so every success is written here
 * immediately rather than at the end of the run.
 */
const SENT_LOG = join(__dirname, "roundup-sent.json");

type SentLog = { note?: string; sent: Array<{ email: string; at: string }> };

function readSentLog(): SentLog {
  if (!existsSync(SENT_LOG)) return { sent: [] };
  try {
    return JSON.parse(readFileSync(SENT_LOG, "utf8")) as SentLog;
  } catch {
    console.warn(`[roundup] could not parse ${SENT_LOG} — treating as empty`);
    return { sent: [] };
  }
}

function recordSent(emails: string[]) {
  if (emails.length === 0) return;
  const log = readSentLog();
  const known = new Set(log.sent.map((s) => s.email.toLowerCase()));
  const at = new Date().toISOString().slice(0, 10);
  for (const email of emails) {
    if (known.has(email.toLowerCase())) continue;
    log.sent.push({ email, at });
    known.add(email.toLowerCase());
  }
  writeFileSync(SENT_LOG, `${JSON.stringify(log, null, 2)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--send");
  const audienceFlag = args.indexOf("--audience");
  const audience = audienceFlag !== -1 ? args[audienceFlag + 1] : undefined;
  const emails = args.filter(
    (a, i) => !a.startsWith("--") && i !== audienceFlag + 1
  );

  if (!audience && emails.length === 0) {
    console.error(
      "Usage: npx tsx scripts/roundup-test.ts <email…> [--send]\n" +
        "       npx tsx scripts/roundup-test.ts --audience <all-volunteers|affected> [--send]"
    );
    process.exit(1);
  }

  // Imported after dotenv so the Airtable/Resend clients see the env vars.
  const { resolveRecipientsForEmails, resolveRoundupRecipients, sendRoundup } =
    await import("../src/lib/roundup");

  const recipients = audience
    ? await resolveRoundupRecipients(
        audience as "all-volunteers" | "affected"
      )
    : await resolveRecipientsForEmails(emails);

  if (recipients.length === 0) {
    console.error("No valid addresses after normalization — nothing to do.");
    process.exit(1);
  }

  console.log("\nResolved recipients:");
  for (const r of recipients) {
    console.log(
      `  ${r.email} → greeting "${r.firstName || "there"}"${
        r.matched ? ` (People ${r.personId})` : " (no People record)"
      }`
    );
  }
  console.log("");

  const alreadySent = readSentLog().sent.map((r) => r.email);
  if (alreadySent.length) {
    console.log(`${alreadySent.length} address(es) already delivered — will be skipped.\n`);
  }

  const results = await sendRoundup(recipients, {
    dryRun: !live,
    alreadySent,
  });

  if (live) {
    recordSent(
      results.filter((r) => r.status === "sent").map((r) => r.email)
    );
  }

  console.log("\nResults:");
  for (const r of results) {
    console.log(`  ${r.status.padEnd(7)} ${r.email}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length) {
    console.log(
      `\n${failed.length} still undelivered. Re-run the same command to resume — ` +
        `the ${results.filter((r) => r.status === "sent").length} sent this run are now logged and will be skipped.`
    );
  }

  if (!live) {
    console.log("\nDry run — nothing was sent. Re-run with --send to deliver.");
  }
}

main().catch((error) => {
  console.error("\nroundup-test failed:", error);
  process.exit(1);
});
