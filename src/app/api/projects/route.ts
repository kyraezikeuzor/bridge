import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchProjects } from "@/lib/airtable/projects";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const projects = (await fetchProjects()).filter(p => p.ownerId === session.user.personId);
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ error: "Projects are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
