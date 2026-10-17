"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PROJECT_ACTIVITY_TEMPLATES, type ProjectActivityCategory } from "@/lib/activityTemplates";

type Center = { id: string; name: string; location: string; country: string };
type ActivityForm = { name: string; track: string; centerId: string; description: string; instructions: string; capacity: number; hoursValue: number; startDate: string; endDate: string };
const field = "mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
export default function CreateActivityPage() {
  const categories = Object.keys(PROJECT_ACTIVITY_TEMPLATES) as ProjectActivityCategory[];
  const [centers, setCenters] = useState<Center[]>([]), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<ProjectActivityCategory>("Letters");
  const template = useMemo(() => PROJECT_ACTIVITY_TEMPLATES[category], [category]);
  const [form, setForm] = useState<ActivityForm>({ name: "", track: "Education", centerId: "", description: "", instructions: template.instructions, capacity: 5, hoursValue: 0, startDate: "", endDate: "" });
  useEffect(() => { fetch("/api/admin/activities").then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setCenters(b.centers); }).catch(e => setError(e.message)); }, []);
  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm(current => ({ ...current, [key]: value })); }
  function chooseCategory(value: ProjectActivityCategory) {
    setCategory(value); const next = PROJECT_ACTIVITY_TEMPLATES[value];
    setForm(current => ({ ...current, instructions: next.instructions }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, category }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setMessage(`“${body.activity.name}” was created as Submitted. Review and approve it before volunteers can sign up.`);
      setForm(current => ({ ...current, name: "", description: "" }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AppShell><main className="mx-auto max-w-3xl space-y-6 px-6 py-10 sm:px-10"><header><p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Director tools</p><h1 className="mt-2 text-3xl font-medium text-neutral-700">Create Activity</h1><p className="mt-2 text-neutral-500">Create a center-specific opportunity inside Bridge. It stays in Submitted until reviewed.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{message && <p role="status" className="rounded-xl bg-sky-50 p-4 text-sky-900">{message}</p>}
    <form onSubmit={submit} className="space-y-6"><section className="grid gap-4 rounded-2xl border-2 border-border p-6 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Activity name<input required maxLength={200} className={field} value={form.name} onChange={e => update("name", e.target.value)} /></label><label className="text-sm">Activity type<select className={field} value={category} onChange={e => chooseCategory(e.target.value as ProjectActivityCategory)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">Track<select className={field} value={form.track} onChange={e => update("track", e.target.value)}><option>Education</option><option>Fundraising</option><option>Programs</option></select></label><label className="text-sm sm:col-span-2">Service center<select required className={field} value={form.centerId} onChange={e => update("centerId", e.target.value)}><option value="">Select an accepted center</option>{centers.map(center => <option key={center.id} value={center.id}>{center.name} — {[center.location, center.country].filter(Boolean).join(", ")}</option>)}</select></label><label className="text-sm sm:col-span-2">Description<textarea required maxLength={5000} rows={4} className={field} value={form.description} onChange={e => update("description", e.target.value)} /></label><label className="text-sm sm:col-span-2">Volunteer instructions<textarea required maxLength={15000} rows={9} className={field} value={form.instructions} onChange={e => update("instructions", e.target.value)} /></label>{template.guideUrl && <p className="text-sm sm:col-span-2">Template source: <a className="text-sky-700 underline" href={template.guideUrl} target="_blank" rel="noreferrer">open current guide</a></p>}</section>
      <section className="grid gap-4 rounded-2xl border-2 border-border p-6 sm:grid-cols-2"><label className="text-sm">Start date<input required type="date" className={field} value={form.startDate} onChange={e => update("startDate", e.target.value)} /></label><label className="text-sm">Deadline<input required type="date" className={field} value={form.endDate} onChange={e => update("endDate", e.target.value)} /></label><label className="text-sm">Available spots<input required type="number" min={1} max={1000} step={1} className={field} value={form.capacity} onChange={e => update("capacity", Number(e.target.value))} /></label><label className="text-sm">Hours per completed activity<input required type="number" min={0} max={1000} step="0.01" className={field} value={form.hoursValue} onChange={e => update("hoursValue", Number(e.target.value))} /><span className="mt-2 block text-xs text-neutral-500">For letters, Bridge uses 3 letters = 1 hour. For other activities, this value is requested with each proof submission.</span></label></section>
      <div className="flex gap-3"><button disabled={busy || !centers.length} className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40">{busy ? "Creating…" : "Create submitted activity"}</button><Link href="/review-activities" className="rounded-lg border px-5 py-3 text-sm">Review activities</Link></div>
    </form></main></AppShell>;
}
