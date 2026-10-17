import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject, mapProject } from "@/lib/airtable/projects";
import { editProject, ProjectError } from "@/lib/projectService";

export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const record = await getProject(params.id);
    const project = record ? mapProject(record) : null;
    if (!project || project.ownerId !== session.user.personId) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch { return NextResponse.json({ error: "Unable to load this project." }, { status: 503 }); }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid project input" }, { status: 400 });
    return NextResponse.json({ project: await editProject(session.user.personId, params.id, input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ProjectError ? error.message : "Unable to save your project. Please try again." }, { status: error instanceof ProjectError ? 422 : 503 });
  }
}
