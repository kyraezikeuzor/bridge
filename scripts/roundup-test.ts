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
 * --limit caps how many are sent in one run, so a large audience can be
 * spread over several hours instead of arriving as one burst. Each run reads
 * the sent log first, so repeating the same command simply continues:
 *
 *   npx tsx scripts/roundup-test.ts --audience all-volunteers --send --limit 400
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
  const limitFlag = args.indexOf("--limit");
  const limit =
    limitFlag !== -1 ? Number(args[limitFlag + 1]) || undefined : undefined;
  const emails = args.filter(
    (a, i) =>
      !a.startsWith("--") && i !== audienceFlag + 1 && i !== limitFlag + 1
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
  const sentSet = new Set(alreadySent.map((e) => e.toLowerCase()));
  if (alreadySent.length) {
    console.log(`${alreadySent.length} address(es) already delivered — will be skipped.`);
  }

  // Trim to the batch BEFORE sending, counting only people who still need it,
  // so --limit 400 means "400 more delivered" rather than "400 considered".
  const outstanding = recipients.filter((r) => !sentSet.has(r.email.toLowerCase()));
  const batch = limit !== undefined ? outstanding.slice(0, limit) : outstanding;
  console.log(
    `${outstanding.length} still outstanding; this run will attempt ${batch.length}.\n`
  );

  const results = await sendRoundup(batch, { dryRun: !live });

  if (live) {
    recordSent(
      results.filter((r) => r.status === "sent").map((r) => r.email)
    );
  }

  console.log("\nResults:");
  for (const r of results) {
    console.log(`  ${r.status.padEnd(7)} ${r.email}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  const sentNow = results.filter((r) => r.status === "sent").length;
  const remaining = outstanding.length - sentNow;
  if (remaining > 0) {
    console.log(
      `\n${remaining} still to go. Re-run the same command for the next batch — ` +
        `the ${sentNow} sent this run are logged and will be skipped.`
    );
  } else if (live) {
    console.log("\nEveryone in this audience has now been delivered to.");
  }

  if (!live) {
    console.log("\nDry run — nothing was sent. Re-run with --send to deliver.");
  }
}

main().catch((error) => {
  console.error("\nroundup-test failed:", error);
  process.exit(1);
});
