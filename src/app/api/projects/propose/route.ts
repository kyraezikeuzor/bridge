import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ProjectError, proposeProject } from "@/lib/projectService";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
    return NextResponse.json({ project: await proposeProject(session.user.personId, input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ProjectError ? error.message : "Unable to submit the proposal. Please retry; an earlier submission will be preserved." }, { status: error instanceof ProjectError ? 422 : 503 });
  }
}
