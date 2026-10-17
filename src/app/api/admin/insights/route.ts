import { NextResponse } from "next/server";
import { fetchAllHours } from "@/lib/airtable/hours";
import { fetchAllPeople } from "@/lib/airtable/people";
import { fetchProjects } from "@/lib/airtable/projects";
import { requireAdminDirector } from "@/lib/directorAuth";

export const dynamic = "force-dynamic";
function sixMonthsAgo() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 6);
  return date.toISOString().slice(0, 10);
}
export async function GET() {
  if (!await requireAdminDirector()) return NextResponse.json({ error: "Director access required" }, { status: 403 });
  try {
    const [people, hours, projects] = await Promise.all([fetchAllPeople(), fetchAllHours(), fetchProjects()]);
    const cutoff = sixMonthsAgo();
    const memberRows = people.map(person => {
      const rows = hours.filter(h => h.personIds.includes(person.id));
      const approved = rows.filter(h => h.status === "Approved");
      const active = approved.some(h => (h.endDate || h.date || h.submittedAt).slice(0, 10) >= cutoff);
      return {
        id: person.id, name: [person.fields["First Name"], person.fields["Last Name"]].filter(Boolean).join(" ") || "Unnamed member",
        role: person.role || "Member", status: person.fields.Status || "", country: person.fields.Country || "", active,
        approvedHours: approved.reduce((sum, h) => sum + (h.hoursRequested || 0), 0), pending: rows.filter(h => h.status === "Submitted").length,
        hours: rows.map(h => ({ id: h.id, activity: h.activityName, hours: h.hoursRequested, status: h.status, date: h.endDate || h.date || h.submittedAt })),
      };
    });
    const completed = projects.filter(p => p.state === "Completed");
    const activeProjects = projects.filter(p => ["In Progress", "Changes Requested", "Submitted", "Awaiting Delivery"].includes(p.state));
    const countries = new Set(completed.map(p => p.centerCountry.trim()).filter(Boolean));
    return NextResponse.json({
      generatedAt: new Date().toISOString(), cutoff,
      metrics: { activeVolunteers: memberRows.filter(m => m.active).length, activeProjects: activeProjects.length, completedProjects: completed.length, countries: countries.size, verifiedItems: completed.reduce((sum, p) => sum + p.verifiedItems, 0), goal: 1000, targetDate: "2027-12-31" },
      members: memberRows.sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch { return NextResponse.json({ error: "Unable to load impact data." }, { status: 503 }); }
}
