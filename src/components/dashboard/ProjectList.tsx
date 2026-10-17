import Link from "next/link";
import type { ActionProject } from "@/lib/airtable/projects";
import { textColor, typography } from "@/styles/typography";

const nextStep: Record<string, string> = {
  Proposed: "Awaiting proposal review",
  "Proposal Approved": "Concept approved; wait for the activity and center confirmation",
  "In Progress": "Complete your work and add delivery evidence",
  "Changes Requested": "Review feedback and resubmit",
  Submitted: "Project review in progress",
  "Awaiting Delivery": "Delivery verification is still needed",
};
export function ProjectList({ loading, projects }: { loading: boolean; projects: ActionProject[] }) {
  const active = projects.filter(p => !["Completed", "Cancelled", "Proposal Rejected"].includes(p.state)).sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999")).slice(0, 4);
  const completed = projects.filter(p => p.state === "Completed").length;
  return <section className="rounded-xl border-2 border-border bg-background p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h3 className={`${typography.status} uppercase ${textColor.secondary}`}>Your Education Action projects</h3><Link href="/projects" className="text-sm text-sky-700">View all</Link></div>{loading ? <div className="h-20 animate-pulse rounded bg-muted/70" /> : active.length ? <div className="space-y-2">{active.map(project => <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-lg border p-4 transition hover:border-sky-300 hover:bg-sky-50/40"><div className="flex items-start justify-between gap-3"><div><p className={`${typography.cardTitle} ${textColor.card}`}>{project.name}</p><p className={`mt-1 ${typography.metadata} ${textColor.secondary}`}>{nextStep[project.state] || project.state}</p></div><span className="text-xs font-medium text-sky-700">{project.state}</span></div>{project.deadline && <p className="mt-2 text-xs text-neutral-500">Due {project.deadline.slice(0,10)}</p>}</Link>)}</div> : <div className="rounded-lg border border-dashed p-5 text-sm text-neutral-500"><p>No active projects. You have completed {completed}.</p><Link href="/projects" className="mt-2 inline-block font-medium text-sky-700">Browse available projects →</Link></div>}</section>;
}
