import { DISCORD_INVITE_URL } from "@/lib/links";
import { sendVolunteerRoundupEmail } from "@/lib/email";
import { getAllPeople, getPersonByEmail } from "@/lib/peopleCache";
import { BROKEN_LINK_RECIPIENTS } from "@/data/roundup-recipients";
import { isLeaderRole } from "@/lib/roles";

/**
 * Volunteer Roundup — a one-off bulk re-send of the welcome email carrying a
 * corrected Discord invite.
 *
 * Every send here lands in a real volunteer's inbox, so the module is built to
 * make a mistaken blast hard: dry run is the default, the recipient set is
 * resolved and returned for review before anything goes out, and sends are
 * serialized so a failure halfway through leaves a precise record of who was
 * already contacted.
 */

/** Who to contact. */
export type RoundupAudience =
  /** Every volunteer on the People roster — the intended default. */
  | "all-volunteers"
  /** Only the addresses logged as having received the dead invite. */
  | "affected";

export type RoundupRecipient = {
  email: string;
  /** Empty when we have no name on file; the send layer decides how to greet. */
  firstName: string;
  personId: string | null;
  /** False when the address has no People record. */
  matched: boolean;
};

export type RoundupSendResult = {
  email: string;
  status: "sent" | "skipped" | "failed";
  detail?: string;
};

/** Resend allows ~2 requests/sec; stay under it with a serialized gap. */
const SEND_INTERVAL_MS = 600;

/** The one People "Status" value that means a current volunteer. */
const ACTIVE_STATUS = "Active";

/**
 * Domains that are unambiguous misspellings of a domain used by hundreds of
 * other volunteers, found by edit-distance against the canonical domains in
 * the roster. Mail to these always bounces, and bounce rate is what damages
 * sender reputation — which is shared with Bridge's magic-link sign-ins.
 *
 * Note there is deliberately no "rare domain" filter behind this list: the
 * worst offender, gmail.con, is shared by seven volunteers, which is exactly
 * what made it look like a real domain on a first pass.
 *
 * These are data-entry errors in the People table. Skipping them here keeps a
 * send clean; correcting the records is the actual fix — until then those
 * volunteers receive nothing from Bridge at all, magic links included.
 */
const UNDELIVERABLE_DOMAINS = new Set([
  "gmail.con",
  "gamil.com",
  "gmil.com",
  "gmzil.com",
  "gmail.cim",
  "gmail.fom",
  "gmail.comc",
  "gmail.come",
  "gmail.comk",
  "gmail.coml",
  "gmail.comt",
  "gmail.comiy",
  "icloud.con",
  "lammersvilleusd.ent",
]);

function isUndeliverable(email: string): boolean {
  return UNDELIVERABLE_DOMAINS.has(email.split("@")[1] ?? "");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isPlausibleEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value);
}

/**
 * Resolve an explicit list of addresses, pulling each name from People where
 * one exists. Used for the "affected" audience and for test sends.
 */
export async function resolveRecipientsForEmails(
  emails: readonly string[]
): Promise<RoundupRecipient[]> {
  const seen = new Set<string>();
  const recipients: RoundupRecipient[] = [];

  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || !isPlausibleEmail(email) || seen.has(email)) continue;
    if (isUndeliverable(email)) {
      console.warn(`[roundup] skipping undeliverable address: ${email}`);
      continue;
    }
    seen.add(email);

    // Personalize where we can; an unmatched address still gets the invite.
    const person = await getPersonByEmail(email);
    recipients.push({
      email,
      firstName: person?.fields["First Name"]?.trim() || "",
      personId: person?.id ?? null,
      matched: person !== null,
    });
  }

  return recipients;
}

/**
 * Resolve an audience to a deduped, name-resolved recipient list.
 * Resolution never sends — call this first and show the result to a human.
 */
export async function resolveRoundupRecipients(
  audience: RoundupAudience
): Promise<RoundupRecipient[]> {
  if (audience === "all-volunteers") {
    const people = await getAllPeople();
    const recipients: RoundupRecipient[] = [];
    const seen = new Set<string>();

    for (const person of people) {
      // Directors get the roundup only if they are also on the volunteer list;
      // this mail is addressed to volunteers.
      if (isLeaderRole(person.role)) continue;

      // Status is a formula and reads "Active" for almost everyone, but not
      // all: "Inactive" means every stint is closed, "Pending" means they have
      // no stint yet. Neither should get mail addressed to current volunteers.
      if ((person.fields.Status ?? "").trim() !== ACTIVE_STATUS) continue;

      const email = normalizeEmail(person.fields.Email ?? "");
      if (!email || !isPlausibleEmail(email) || seen.has(email)) continue;
      if (isUndeliverable(email)) {
        console.warn(`[roundup] skipping undeliverable address: ${email}`);
        continue;
      }
      seen.add(email);

      recipients.push({
        email,
        firstName: person.fields["First Name"]?.trim() || "",
        personId: person.id,
        matched: true,
      });
    }
    return recipients.sort((a, b) => a.email.localeCompare(b.email));
  }

  return resolveRecipientsForEmails(BROKEN_LINK_RECIPIENTS);
}

export type SendRoundupOptions = {
  /** When true (the default) nothing is sent — results report what would go out. */
  dryRun?: boolean;
  /** Addresses already contacted in a previous run; skipped rather than re-sent. */
  alreadySent?: string[];
  /** Overrides the invite in the email body. Defaults to the canonical one. */
  discordUrl?: string;
};

/**
 * Send the roundup to a resolved recipient list.
 *
 * Sends are serialized on purpose. Throughput does not matter for a list this
 * size, and a sequential run means the returned results are an accurate record
 * of exactly who was emailed if the run dies partway.
 */
export async function sendRoundup(
  recipients: RoundupRecipient[],
  options: SendRoundupOptions = {}
): Promise<RoundupSendResult[]> {
  const dryRun = options.dryRun ?? true;
  const discordUrl = options.discordUrl ?? DISCORD_INVITE_URL;
  const alreadySent = new Set(
    (options.alreadySent ?? []).map((e) => normalizeEmail(e))
  );

  const results: RoundupSendResult[] = [];

  console.log(
    `[roundup] ${dryRun ? "DRY RUN" : "LIVE SEND"} — ${recipients.length} recipient(s), invite ${discordUrl}`
  );

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    if (alreadySent.has(recipient.email)) {
      results.push({
        email: recipient.email,
        status: "skipped",
        detail: "already sent in a previous run",
      });
      continue;
    }

    if (dryRun) {
      results.push({
        email: recipient.email,
        status: "skipped",
        detail: `dry run — would greet "${recipient.firstName || "there"}"`,
      });
      continue;
    }

    try {
      await sendVolunteerRoundupEmail(
        recipient.email,
        recipient.firstName,
        discordUrl
      );
      results.push({ email: recipient.email, status: "sent" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(`[roundup] failed for ${recipient.email}:`, detail);
      results.push({ email: recipient.email, status: "failed", detail });
    }

    if (index < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(
    `[roundup] finished — ${sent} sent, ${failed} failed, ${results.length - sent - failed} skipped`
  );

  return results;
}
