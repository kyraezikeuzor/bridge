"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import type { ActionProject } from "@/lib/airtable/projects";
import { canEditProject, type DeliveryMethod } from "@/lib/projectRules";

const inputStyle = "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-50";
export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ActionProject | null>(null), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; fetch(`/api/projects/${params.id}`).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); if (active) setProject({ ...b.project, method: b.project.method || (b.project.category === "Letters" ? "Omelora mailing" : b.project.category === "Service Day" ? "Service confirmation" : "Shipped") }); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [params.id]);
  const editable = project ? canEditProject(project.state) : false;
  function patch(update: Partial<ActionProject>) { setProject(p => p ? { ...p, ...update } : p); setMessage(""); }
  async function save(action: "save" | "submit") {
    if (!project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(`/api/projects/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, quantity: project.quantity, requestedHours: project.requestedHours, work: project.work, method: project.method, tracking: project.tracking, confirmation: project.confirmation, reflection: project.reflection }) });
      const b = await r.json(); if (!r.ok) throw new Error(b.error); setProject(b.project); setMessage(action === "save" ? "Draft saved." : "Submitted for project review. Hours are reviewed separately after verification.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function upload(kind: string, file?: File) {
    if (!file) return; setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("kind", kind); form.set("file", file);
      const r = await fetch(`/api/projects/${params.id}/photos`, { method: "POST", body: form });
      const b = await r.json(); if (!r.ok) throw new Error(b.error);
      // Keep unsaved text while merging the freshly uploaded evidence.
      setProject(p => p ? { ...p, itemPhotos: b.project.itemPhotos, deliveryPhotos: b.project.deliveryPhotos } : p); setMessage("Photo uploaded. Save your draft to keep any text changes.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AppShell><main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
    <Link href="/projects" className="text-sm text-neutral-500">← My Projects</Link>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{message && <p role="status" className="rounded-xl bg-sky-50 p-4 text-sky-900">{message}</p>}
    {!project ? !error && <p>Loading your project…</p> : <>
      <header><p className="text-sm font-medium text-sky-700">{project.state}</p><h1 className="mt-2 text-2xl font-medium tracking-tight text-neutral-700">{project.name}</h1><p className="mt-2 text-sm text-neutral-500">{project.location} {project.deadline && `· Due ${project.deadline.slice(0,10)}`}</p></header>
      {["Proposed", "Proposal Approved", "Proposal Rejected"].includes(project.state) ? <ProposalSummary project={project} /> : <>
      {project.reviewNotes && <section className="rounded-xl bg-amber-50 p-4"><h2 className="font-medium">Director feedback</h2><p className="mt-2 whitespace-pre-wrap text-sm">{project.reviewNotes}</p></section>}
      <ol className="grid grid-cols-3 gap-2 text-xs text-neutral-500"><li>1 · Complete your work</li><li>2 · Add delivery evidence</li><li>3 · Submit for review</li></ol>
      <fieldset disabled={!editable || busy} className="space-y-6 disabled:opacity-80">
        <section className="space-y-4 rounded-2xl border border-neutral-200 p-5"><h2 className="text-lg font-medium text-neutral-700">1. Your work</h2><p className="text-sm text-neutral-500">{project.category === "Letters" ? "Write or paste your letters below, separating each letter with a heading. Save your draft as you go. Omelora handles printing and mailing." : "Describe what you completed for the center. For kits, deliver directly to the center—Omelora has no PO box."}</p>
          <label className="block text-sm">{project.category === "Letters" ? "Your letters" : "Work details"}<textarea rows={12} maxLength={60000} className={inputStyle} value={project.work} onChange={e => patch({ work: e.target.value })} /></label>
          <label className="block text-sm">{project.category === "Service Day" ? "Service sessions completed" : "Number of items completed"} (minimum {project.minimum})<input type="number" min={0} max={100000} step={1} className={inputStyle} value={project.quantity} onChange={e => patch({ quantity: Number(e.target.value) })} /></label>
          {project.category !== "Letters" && project.category !== "Service Day" && <label className="block text-sm">Item photos (JPG, PNG, WebP; up to 5 MB each)<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block text-sm" onChange={e => { void upload("items", e.target.files?.[0]); e.target.value = ""; }} /></label>}
          <PhotoLinks photos={project.itemPhotos} />
        </section>
        <section className="space-y-4 rounded-2xl border border-neutral-200 p-5"><h2 className="text-lg font-medium text-neutral-700">2. Delivery evidence</h2>
          <label className="block text-sm">Delivery method<select className={inputStyle} value={project.method} onChange={e => patch({ method: e.target.value as DeliveryMethod })}>{project.category === "Letters" ? <option>Omelora mailing</option> : project.category === "Service Day" ? <option>Service confirmation</option> : <><option>Shipped</option><option>In person</option></>}</select></label>
          {project.method === "Omelora mailing" ? <p className="text-sm text-neutral-500">Your director will review the letters, arrange mailing, and verify delivery before marking this project completed.</p> : <>
            {project.method === "Shipped" && <label className="block text-sm">Carrier and tracking / mailing reference<input maxLength={500} className={inputStyle} value={project.tracking} onChange={e => patch({ tracking: e.target.value })} /></label>}
            <label className="block text-sm">Center confirmation / delivery details<textarea rows={3} maxLength={4000} className={inputStyle} value={project.confirmation} onChange={e => patch({ confirmation: e.target.value })} /></label>
            <label className="block text-sm">Delivery / service photo<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block text-sm" onChange={e => { void upload("delivery", e.target.files?.[0]); e.target.value = ""; }} /></label><p className="text-xs text-neutral-500">For in-person delivery, include a consenting center associate. If photography is not permitted, provide a center confirmation instead. Avoid identifiable children or private information.</p>
          </>}<PhotoLinks photos={project.deliveryPhotos} />
        </section>
        <section className="space-y-4 rounded-2xl border border-neutral-200 p-5"><h2 className="text-lg font-medium text-neutral-700">3. Reflection and hours</h2><label className="block text-sm">What did you learn? (optional)<textarea rows={4} maxLength={5000} className={inputStyle} value={project.reflection} onChange={e => patch({ reflection: e.target.value })} /></label><label className="block text-sm">Hours you are requesting<input type="number" min={0} max={1000} step="0.01" className={inputStyle} value={project.requestedHours} onChange={e => patch({ requestedHours: Number(e.target.value) })} /></label><p className="text-xs text-neutral-500">Requested hours are not an award. A director verifies your project and reviews your hours separately.</p></section>
        {editable && <div className="flex flex-wrap gap-3"><button onClick={() => void save("save")} className="rounded-lg border px-5 py-3 text-sm font-medium">Save draft</button><button onClick={() => void save("submit")} className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white">Submit for review</button></div>}
      </fieldset>
      {!editable && <p className="text-sm text-neutral-500">{project.state === "Completed" ? "Your project is verified and completed. Check Hours for the separate credit review." : "Your submitted work is read-only. Your director will contact you here if changes are needed."}</p>}
      </>}
    </>}
  </main></AppShell>;
}
function PhotoLinks({ photos }: { photos: ActionProject["itemPhotos"] }) { return <ul className="space-y-2">{photos.map((photo, i) => <li key={`${photo.filename}-${i}`}><a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 underline">{photo.filename}</a></li>)}</ul>; }
function ProposalSummary({ project }: { project: ActionProject }) {
  const approved = project.state === "Proposal Approved", rejected = project.state === "Proposal Rejected";
  return <section className="space-y-5 rounded-2xl border p-6"><div><h2 className="text-lg font-medium">{approved ? "Concept approved for planning" : rejected ? "Proposal not approved" : "Proposal under review"}</h2><p className="mt-2 text-sm text-neutral-500">{approved ? "A director approved the concept. Wait for the verified center and activity to be created before spending, starting work, or counting impact." : rejected ? "This proposal will not move forward in its current form. Review the director's note before proposing another project." : "Do not spend money, contact the organization as Omelora, or begin counting impact until a director approves the proposal and creates the activity."}</p></div>{project.reviewNotes && <div className="rounded-xl bg-amber-50 p-4"><p className="font-medium">Director feedback</p><p className="mt-2 whitespace-pre-wrap text-sm">{project.reviewNotes}</p></div>}<dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-neutral-500">Organization</dt><dd className="mt-1">{project.proposalOrganization}</dd></div><div><dt className="text-neutral-500">Adult / organization contact</dt><dd className="mt-1">{project.proposalContactName}</dd></div><div><dt className="text-neutral-500">Contact email</dt><dd className="mt-1">{project.proposalContactEmail}</dd></div><div><dt className="text-neutral-500">Estimated cost</dt><dd className="mt-1">${project.proposalCost.toFixed(2)}</dd></div><div className="sm:col-span-2"><dt className="text-neutral-500">Need and plan</dt><dd className="mt-1 whitespace-pre-wrap">{project.proposalNeed}</dd></div><div><dt className="text-neutral-500">Proposed completion</dt><dd className="mt-1">{project.proposalCompletionDate}</dd></div></dl></section>;
}
