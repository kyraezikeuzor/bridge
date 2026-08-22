import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLeaderRole } from "@/lib/roles";
import { DISCORD_INVITE_URL } from "@/lib/links";
import {
  resolveRecipientsForEmails,
  resolveRoundupRecipients,
  sendRoundup,
  type RoundupAudience,
} from "@/lib/roundup";

export const dynamic = "force-dynamic";

/** Typing this exactly is required before any live send. */
const CONFIRM_PHRASE = "SEND ROUNDUP";

const AUDIENCES: RoundupAudience[] = ["all-volunteers", "affected"];

/** A "test" send is for checking rendering, not for reaching an audience. */
const MAX_TEST_RECIPIENTS = 5;

function parseAudience(value: unknown): RoundupAudience | null {
  return AUDIENCES.includes(value as RoundupAudience)
    ? (value as RoundupAudience)
    : null;
}

/** Only directors may preview or send. */
async function requireDirector(): Promise<
  { email: string } | { status: number; error: string }
> {
  const session = await auth();
  const email = session?.user?.email?.trim() || "";
  if (!email) return { status: 401, error: "Not signed in" };
  if (!isLeaderRole(session?.user?.role)) {
    return { status: 403, error: "Directors only" };
  }
  return { email };
}

/**
 * GET /api/roundup?audience=all-volunteers — preview the recipient list.
 * Never sends. Use it to eyeball who would be contacted.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireDirector();
    if ("error" in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const audience =
      parseAudience(request.nextUrl.searchParams.get("audience")) ??
      "all-volunteers";
    const recipients = await resolveRoundupRecipients(audience);

    return NextResponse.json({
      audience,
      discordUrl: DISCORD_INVITE_URL,
      total: recipients.length,
      unmatched: recipients.filter((r) => !r.matched).length,
      recipients,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/roundup — run the roundup.
 *
 * Defaults to a dry run. A live send additionally requires
 * `dryRun: false` AND `confirm: "SEND ROUNDUP"`, so neither a stray
 * request nor a mistyped flag alone can mail the whole roster.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireDirector();
    if ("error" in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const input = (body ?? {}) as Record<string, unknown>;

    // A test send targets explicit addresses and ignores the audience entirely.
    const testEmails = Array.isArray(input.testEmails)
      ? input.testEmails.filter((v): v is string => typeof v === "string")
      : [];
    const isTest = testEmails.length > 0;

    if (isTest && testEmails.length > MAX_TEST_RECIPIENTS) {
      return NextResponse.json(
        { error: `A test send takes at most ${MAX_TEST_RECIPIENTS} addresses` },
        { status: 400 }
      );
    }

    const audience = isTest ? null : parseAudience(input.audience);
    if (!isTest && !audience) {
      return NextResponse.json(
        { error: `"audience" must be one of: ${AUDIENCES.join(", ")}` },
        { status: 400 }
      );
    }

    // Anything other than an explicit false stays a dry run.
    const dryRun = input.dryRun !== false;

    if (!dryRun && input.confirm !== CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          error: `A live send requires confirm: "${CONFIRM_PHRASE}"`,
        },
        { status: 400 }
      );
    }

    const alreadySent = Array.isArray(input.alreadySent)
      ? input.alreadySent.filter((v): v is string => typeof v === "string")
      : [];

    const recipients = isTest
      ? await resolveRecipientsForEmails(testEmails)
      : await resolveRoundupRecipients(audience!);

    if (!dryRun) {
      console.log(
        `[api/roundup] LIVE SEND authorized by ${gate.email} — ${
          isTest ? `TEST to ${recipients.length} address(es)` : `audience "${audience}"`
        }, ${recipients.length} recipient(s)`
      );
    }

    const results = await sendRoundup(recipients, { dryRun, alreadySent });

    return NextResponse.json({
      audience: isTest ? "test" : audience,
      dryRun,
      discordUrl: DISCORD_INVITE_URL,
      total: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/roundup] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
