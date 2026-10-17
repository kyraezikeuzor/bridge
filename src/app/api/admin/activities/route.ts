import { NextResponse } from "next/server";
import { createProjectActivity } from "@/lib/airtable/activities";
import { asStringArray, getRecord, listAllRecords } from "@/lib/airtable/client";
import { refreshActivitiesCache } from "@/lib/activitiesCache";
import { PROJECT_ACTIVITY_TEMPLATES, type ProjectActivityCategory } from "@/lib/activityTemplates";
import { requireAdminDirector } from "@/lib/directorAuth";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!await requireAdminDirector()) return NextResponse.json({ error: "Director access required" }, { status: 403 });
  try {
    const records = await listAllRecords<Record<string, unknown>>("Partnerships");
    const centers = records.filter(r => asStringArray(r.fields.Status).includes("Accepted")).map(r => ({ id: r.id, name: String(r.fields.Name || "Center"), location: String(r.fields.Location || ""), country: String(r.fields.Country || "") }));
    return NextResponse.json({ centers, categories: Object.keys(PROJECT_ACTIVITY_TEMPLATES) });
  } catch { return NextResponse.json({ error: "Unable to load service centers." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const director = await requireAdminDirector();
  if (!director) return NextResponse.json({ error: "Director access required" }, { status: 403 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const read = (key: string, max: number, required = true) => {
      const value = input[key];
      if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`Check ${key}.`);
      return value.trim();
    };
    const name = read("name", 200), track = read("track", 30), category = read("category", 50) as ProjectActivityCategory;
    const description = read("description", 5000), instructions = read("instructions", 15000), centerId = read("centerId", 50);
    const startDate = read("startDate", 10), endDate = read("endDate", 10);
    const template = PROJECT_ACTIVITY_TEMPLATES[category];
    if (!template || !["Education", "Fundraising", "Programs"].includes(track)) throw new Error("Choose a valid activity type and track.");
    if (!/^rec[a-zA-Z0-9]+$/.test(centerId) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) throw new Error("Check the center and activity dates.");
    const center = await getRecord<Record<string, unknown>>("Partnerships", centerId);
    if (!center || !asStringArray(center.fields.Status).includes("Accepted")) throw new Error("Choose an accepted service center.");
    const capacity = input.capacity, hoursValue = input.hoursValue;
    if (!Number.isSafeInteger(capacity) || Number(capacity) < 1 || Number(capacity) > 1000) throw new Error("Capacity must be a whole number between 1 and 1,000.");
    if (typeof hoursValue !== "number" || !Number.isFinite(hoursValue) || hoursValue < 0 || hoursValue > 1000) throw new Error("Check the activity hours value.");
    const activity = await createProjectActivity({
      "Activity Name": name, Track: track, Type: template.type, Category: ["Letters", "Care Kits", "School Kits"].includes(category) ? category : "Other",
      "Project Category": category, "Completion Workflow": category === "Letters" ? "Letters" : "Photo proof", Description: description, Instructions: instructions, "Hours Value": hoursValue,
      "Slots Total": capacity as number, "Start Date": startDate, "End Date": endDate, Status: "Submitted", Platform: "Bridge",
      "Creates Project": false,
      "Project Guide URL": template.guideUrl || undefined, "Linked Service Center": [centerId], "Created By": [director.personId],
    });
    await refreshActivitiesCache();
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create the activity." }, { status: 422 });
  }
}
