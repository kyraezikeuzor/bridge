import { Button, Input } from "@omelora/sunrise";
import type { Profile, ProfileDraft } from "./types";

const GENDERS = ["Female", "Male", "Other"];
const COUNTRIES = ["United States", "Canada", "Nigeria"];

function optionsWithCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

type ProfileFormProps = {
  profile: Profile;
  draft: ProfileDraft;
  saving: boolean;
  onChange: (field: keyof ProfileDraft, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ProfileForm({ profile, draft, saving, onChange, onSave, onCancel }: ProfileFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input label="Email" name="email" value={profile.email} disabled className="bg-muted/50" />
      <div className="grid grid-cols-2 gap-4"><Input label="First Name" name="firstName" value={profile.firstName} disabled className="bg-muted/50" /><Input label="Last Name" name="lastName" value={profile.lastName} disabled className="bg-muted/50" /></div>
      <Input label="Discord" name="discord" value={draft.discord} onChange={(event) => onChange("discord", event.target.value)} placeholder="username#1234" />
      <Input label="Birthday" name="birthday" type="date" value={draft.birthday} onChange={(event) => onChange("birthday", event.target.value)} />
      <label htmlFor="gender" className="flex w-full flex-col gap-1.5 text-sm font-medium text-foreground">Gender<select id="gender" value={draft.gender} onChange={(event) => onChange("gender", event.target.value)} className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">—</option>{optionsWithCurrent(GENDERS, draft.gender).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-4">
        <Input label="State" name="state" value={draft.state} onChange={(event) => onChange("state", event.target.value)} />
        <label htmlFor="country" className="flex w-full flex-col gap-1.5 text-sm font-medium text-foreground">Country<select id="country" value={draft.country} onChange={(event) => onChange("country", event.target.value)} className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">—</option>{optionsWithCurrent(COUNTRIES, draft.country).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>
      <div className="flex gap-3 pt-2"><Button type="button" variant="primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button></div>
    </div>
  );
}
