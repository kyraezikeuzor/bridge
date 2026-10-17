import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersonById } from "@/lib/airtable/people";
import { fetchProjects } from "@/lib/airtable/projects";
import { ProjectError, reviewProject, reviewProposal } from "@/lib/projectService";
export const dynamic = "force-dynamic";
async function reviewer() {
  const session = await auth();
  if (!session?.user?.personId) return null;
  const person = await getPersonById(session.user.personId);
  return person && /^(Executive Director|Track Director)$/i.test(person.role || "") ? person.id : null;
}
export async function GET() {
  try {
    if (!await reviewer()) return NextResponse.json({ error: "Director access required" }, { status: 403 });
    return NextResponse.json({ projects: (await fetchProjects()).filter(p => ["Proposed", "Submitted", "Awaiting Delivery"].includes(p.state)) });
  } catch { return NextResponse.json({ error: "Unable to load project reviews." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const personId = await reviewer();
    if (!personId) return NextResponse.json({ error: "Director access required" }, { status: 403 });
    const body = await request.json();
    if (typeof body?.id !== "string" || typeof body.action !== "string" || typeof body.note !== "string") return NextResponse.json({ error: "Invalid review input" }, { status: 400 });
    if (["approve-proposal", "reject-proposal"].includes(body.action)) return NextResponse.json({ project: await reviewProposal(personId, body.id, body.action, body.note) });
    if (typeof body.verifiedItems !== "number") return NextResponse.json({ error: "Invalid verified item count" }, { status: 400 });
    return NextResponse.json({ project: await reviewProject(personId, body.id, body.action, body.note, body.verifiedItems) });
  } catch (error) { return NextResponse.json({ error: error instanceof ProjectError ? error.message : "Unable to save the review. Refresh before retrying." }, { status: error instanceof ProjectError ? 422 : 503 }); }
}
