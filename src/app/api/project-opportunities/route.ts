import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { asStringArray, listAllRecords } from "@/lib/airtable/client";
import { fetchProjects } from "@/lib/airtable/projects";
import { createsProject, minimumQuantity } from "@/lib/projectRules";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await auth())?.user?.personId) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  try {
    const activities = await listAllRecords<Record<string, unknown>>("Activities", { filterByFormula: "AND({Creates Project}=1,{Status}='Active')" });
    const centers = await listAllRecords<Record<string, unknown>>("Partnerships");
    const projects = await fetchProjects();
    const opportunities = activities.filter(a => createsProject(String(a.fields.Type), a.fields["Creates Project"] === true)).flatMap(a => {
      const f = a.fields, center = centers.find(c => c.id === asStringArray(f["Linked Service Center"])[0]);
      if (!center || !asStringArray(center.fields.Status).includes("Accepted")) return [];
      if (typeof f["End Date"] === "string" && f["End Date"].slice(0,10) < new Date().toISOString().slice(0,10)) return [];
      const capacity = typeof f["Project Capacity"] === "number" ? f["Project Capacity"] : 5;
      return [{ id: a.id, name: String(f["Activity Name"] || "Activity"), type: String(f.Type), category: String(f["Project Category"] || f.Category || "Other"),
        center: String(center.fields.Name || "Center"), location: String(center.fields.Location || ""), country: String(center.fields.Country || ""),
        description: String(f.Description || ""), instructions: String(f.Instructions || ""), deadline: String(f["End Date"] || ""),
        guideUrl: String(f["Project Guide URL"] || ""),
        minimum: minimumQuantity(String(f.Category || "Other"), Number(f["Project Minimum Quantity"]) || undefined), capacity,
        remaining: Math.max(0, capacity - projects.filter(p => p.activityId === a.id && p.state !== "Cancelled").length) }];
    });
    return NextResponse.json({ opportunities });
  } catch { return NextResponse.json({ error: "Unable to load project opportunities." }, { status: 503 }); }
}
