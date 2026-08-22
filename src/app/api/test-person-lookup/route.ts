import { NextRequest, NextResponse } from "next/server";
import { getPersonByEmail } from "@/lib/peopleCache";

export const dynamic = "force-dynamic";

/**
 * Test route for cached People email lookup.
 * GET /api/test-person-lookup?email=someone@example.com
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Missing required query param: email" },
      { status: 400 }
    );
  }

  try {
    const person = await getPersonByEmail(email);
    return NextResponse.json({
      email,
      found: person !== null,
      person,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
