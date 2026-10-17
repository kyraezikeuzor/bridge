import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ProjectError, startProject } from "@/lib/projectService";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body?.activityId !== "string") return NextResponse.json({ error: "Choose an activity" }, { status: 400 });
    return NextResponse.json({ project: await startProject(session.user.personId, body.activityId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ProjectError ? error.message : "Unable to start the project. Please retry; an existing signup will be preserved." }, { status: error instanceof ProjectError ? 409 : 503 });
  }
}
