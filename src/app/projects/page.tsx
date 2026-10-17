"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { ActionProject } from "@/lib/airtable/projects";

type Opportunity = { id: string; name: string; center: string; location: string; country: string; type: string; category: string; description: string; instructions: string; guideUrl: string; minimum: number; deadline: string; remaining: number; capacity: number };
export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ActionProject[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"mine" | "available">("mine");
  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/projects"), fetch("/api/project-opportunities")].map(async response => {
      const r = await response, body = await r.json();
      if (!r.ok) throw new Error(body.error);
      return body;
    })).then(([mine, board]) => { if (active) { setProjects(mine.projects); setOpportunities(board.opportunities); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function start(activityId: string) {
    setBusy(activityId); setError("");
    try {
      const response = await fetch("/api/projects/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      router.push(`/projects/${body.project.id}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  return <AppShell><main className="mx-auto max-w-6xl space-y-7 px-6 py-10 sm:px-10">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Education Action</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-neutral-700">My Projects</h1><p className="mt-2 text-neutral-500">Turn a community need into action. One project, led by you.</p></div><Link href="/projects/propose" className="rounded-lg border px-4 py-2 text-sm font-medium">Propose your own project</Link></header>
    <div className="grid grid-cols-3 gap-4"><Stat label="Active projects" count={projects.filter(p => ["In Progress", "Changes Requested", "Submitted", "Awaiting Delivery"].includes(p.state)).length} /><Stat label="Proposals" count={projects.filter(p => ["Proposed", "Proposal Approved", "Proposal Rejected"].includes(p.state)).length} /><Stat label="Completed projects" count={projects.filter(p => p.state === "Completed").length} /></div>
    <div className="flex gap-2 border-b border-neutral-200" role="tablist" aria-label="Projects"><button role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={`px-4 py-3 text-sm ${tab === "mine" ? "border-b-2 border-sky-500 text-neutral-900" : "text-neutral-500"}`}>My projects</button><button role="tab" aria-selected={tab === "available"} onClick={() => setTab("available")} className={`px-4 py-3 text-sm ${tab === "available" ? "border-b-2 border-sky-500 text-neutral-900" : "text-neutral-500"}`}>Available projects</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status">Loading projects…</p> : tab === "mine" ? <section className="grid gap-4 sm:grid-cols-2">{projects.map(p => { const proposal = ["Proposed", "Proposal Approved", "Proposal Rejected"].includes(p.state); return <Link key={p.id} href={`/projects/${p.id}`} className="rounded-2xl border border-neutral-200 p-5 transition hover:border-sky-300"><p className="text-xs font-medium text-sky-700">{p.state}</p><h2 className="mt-3 font-medium text-neutral-700">{p.name}</h2><p className="mt-2 text-sm text-neutral-500">{proposal ? p.proposalOrganization : p.location || "Center location pending"}</p><p className="mt-4 text-xs text-neutral-500">{p.deadline ? `Due ${p.deadline.slice(0,10)}` : "No deadline set"}</p><p className="mt-4 text-sm font-medium">Open {proposal ? "proposal" : "project"} →</p></Link>; })}{!projects.length && !error && <div className="rounded-2xl border border-dashed p-7 text-neutral-500">Your first project starts here. Choose Available projects to find a center to support.</div>}</section> : <section className="grid gap-4 sm:grid-cols-2">{opportunities.map(o => <article key={o.id} className="rounded-2xl border border-neutral-200 p-5"><p className="text-xs text-sky-700">{o.category} · {o.type} · {o.remaining}/{o.capacity} slots available</p><h2 className="mt-3 font-medium text-neutral-700">{o.name}</h2><p className="mt-2 text-sm font-medium">{o.center}</p><p className="text-sm text-neutral-500">{[o.location, o.country].filter(Boolean).join(", ") || "Ask the director for the location"}</p><p className="mt-4 whitespace-pre-wrap text-sm text-neutral-600">{o.description}</p><details className="mt-3 text-sm"><summary className="cursor-pointer">Instructions and requirements</summary><p className="mt-2 whitespace-pre-wrap">{o.instructions}</p><p className="mt-2">Minimum quantity: {o.minimum}. Deadline: {o.deadline || "To be confirmed"}.</p>{o.guideUrl && <a className="mt-2 inline-block text-sky-700 underline" href={o.guideUrl} target="_blank" rel="noreferrer">Open project guide</a>}</details><button disabled={Boolean(busy) || o.remaining === 0} onClick={() => void start(o.id)} className="mt-5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{busy === o.id ? "Starting…" : o.remaining ? "Sign up & start project" : "All slots filled"}</button></article>)}{!opportunities.length && !error && <p className="rounded-2xl border border-dashed p-7 text-neutral-500">No project opportunities are open yet. Your existing activities and hours remain available.</p>}</section>}
    <Link href="/activities" className="inline-block text-sm text-neutral-500 underline">Existing activities and programs</Link>
  </main></AppShell>;
}
function Stat({ label, count }: { label: string; count: number }) { return <div className="rounded-2xl border border-neutral-200 p-5"><p className="text-sm text-neutral-500">{label}</p><p className="mt-3 text-3xl tabular-nums text-neutral-700">{count}</p></div>; }
