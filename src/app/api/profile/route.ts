import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonByEmail, savePersonProfile } from "@/lib/peopleCache";
import type { Person, PersonProfileUpdate } from "@/lib/airtable";

export const dynamic = "force-dynamic";

/** Fields a person may change about themselves. Name/email are not editable here. */
const EDITABLE_KEYS = [
  "discord",
  "birthday",
  "gender",
  "state",
  "country",
] as const;

type EditableKey = (typeof EDITABLE_KEYS)[number];

const MAX_FIELD_LENGTH = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function serializeProfile(person: Person, fallbackEmail: string) {
  const f = person.fields;
  return {
    id: person.id,
    role: person.role,
    firstName: f["First Name"]?.trim() ?? "",
    lastName: f["Last Name"]?.trim() ?? "",
    email: f.Email?.trim() ?? fallbackEmail,
    discord: f.Discord?.trim() ?? "",
    birthday: f.Birthday ?? "",
    gender: f.Gender ?? "",
    state: f.State ?? "",
    country: f.Country ?? "",
    joined: f.Joined ?? "",
  };
}

/**
 * Validate the request body into an Airtable update.
 * Only keys actually present are included; "" clears the field.
 */
function parseUpdate(
  body: unknown
): { update: PersonProfileUpdate } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Expected a JSON object" };
  }

  const input = body as Record<string, unknown>;
  const update: PersonProfileUpdate = {};

  for (const key of EDITABLE_KEYS) {
    if (!(key in input)) continue;

    const raw = input[key];
    if (raw !== null && typeof raw !== "string") {
      return { error: `"${key}" must be a string` };
    }

    const value = (raw ?? "").trim();
    if (value.length > MAX_FIELD_LENGTH) {
      return { error: `"${key}" is too long (max ${MAX_FIELD_LENGTH})` };
    }
    if (key === "birthday" && value && !ISO_DATE.test(value)) {
      return { error: `"birthday" must be YYYY-MM-DD` };
    }

    // Airtable clears a field when it is sent as null, not "".
    update[key as EditableKey] = value === "" ? null : value;
  }

  if (Object.keys(update).length === 0) {
    return { error: "No editable fields in request" };
  }
  return { update };
}

/** Resolve the signed-in user's People record. */
async function requirePerson(): Promise<
  { person: Person; email: string } | { status: number; error: string }
> {
  const session = await auth();
  const email = session?.user?.email?.trim() || "";
  if (!email) return { status: 401, error: "Not signed in" };

  const person = await getPersonByEmail(email);
  if (!person) return { status: 404, error: `No People record for ${email}` };

  return { person, email };
}

/** GET /api/profile — the signed-in user's People record. */
export async function GET() {
  try {
    const found = await requirePerson();
    if ("error" in found) {
      return NextResponse.json(
        { error: found.error },
        { status: found.status }
      );
    }
    return NextResponse.json(serializeProfile(found.person, found.email));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/profile — update the signed-in user's own People record.
 * The record id always comes from the session, never from the request body.
 */
export async function PATCH(request: NextRequest) {
  try {
    const found = await requirePerson();
    if ("error" in found) {
      return NextResponse.json(
        { error: found.error },
        { status: found.status }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseUpdate(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await savePersonProfile(
      found.person.id,
      found.email,
      parsed.update
    );
    console.log(`[api/profile] updated People record ${found.person.id}`);

    return NextResponse.json(serializeProfile(updated, found.email));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/profile] PATCH failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
