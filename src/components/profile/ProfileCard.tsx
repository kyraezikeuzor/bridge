import type { Profile } from "./types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

function Field({ label, value }: { label: string; value?: string }) {
  return <div><p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm text-foreground">{value || "—"}</p></div>;
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border-2 border-border bg-background p-6">
      <div className="grid grid-cols-2 gap-5"><Field label="First Name" value={profile.firstName} /><Field label="Last Name" value={profile.lastName} /></div>
      <Field label="Email" value={profile.email} />
      <Field label="Discord" value={profile.discord} />
      <div className="grid grid-cols-2 gap-5"><Field label="Birthday" value={formatDate(profile.birthday)} /><Field label="Gender" value={profile.gender} /></div>
      <div className="grid grid-cols-2 gap-5"><Field label="State" value={profile.state} /><Field label="Country" value={profile.country} /></div>
      <Field label="Member Since" value={formatDate(profile.joined)} />
    </div>
  );
}
