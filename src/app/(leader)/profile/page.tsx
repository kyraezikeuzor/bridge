"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { currentUser } from "@/data/session";
import type { AppUser } from "@/data/session";

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<AppUser>(currentUser);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [discord, setDiscord] = useState(profile.discord);
  const [birthday, setBirthday] = useState(profile.birthday);
  const [gender, setGender] = useState(profile.gender);
  const [state, setState] = useState(profile.state);
  const [country, setCountry] = useState(profile.country);

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  const startEdit = () => {
    setDiscord(profile.discord);
    setBirthday(profile.birthday);
    setGender(profile.gender);
    setState(profile.state);
    setCountry(profile.country);
    setEditing(true);
  };

  const handleSave = () => {
    setSaving(true);
    window.setTimeout(() => {
      setProfile((prev) => ({
        ...prev,
        discord,
        birthday,
        gender,
        state,
        country,
      }));
      setSaving(false);
      setEditing(false);
    }, 400);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-normal text-[#3F3F3F] sm:text-4xl">
          My Profile
        </h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
            <RefreshCw
              className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {!editing ? (
            <Button type="button" variant="outline" onClick={startEdit}>
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-5">
          <Input
            label="Email"
            name="email"
            value={profile.email}
            disabled
            className="bg-muted/50"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="firstName"
              value={profile.firstName}
              disabled
              className="bg-muted/50"
            />
            <Input
              label="Last Name"
              name="lastName"
              value={profile.lastName}
              disabled
              className="bg-muted/50"
            />
          </div>
          <Input
            label="Discord"
            name="discord"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="username#1234"
          />
          <Input
            label="Birthday"
            name="birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <div className="flex w-full flex-col gap-1.5">
            <label
              htmlFor="gender"
              className="text-sm font-medium text-foreground"
            >
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="State"
              name="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
            <div className="flex w-full flex-col gap-1.5">
              <label
                htmlFor="country"
                className="text-sm font-medium text-foreground"
              >
                Country
              </label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Nigeria">Nigeria</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-xl border-2 border-border bg-background p-6">
          <div className="grid grid-cols-2 gap-5">
            <ProfileField label="First Name" value={profile.firstName} />
            <ProfileField label="Last Name" value={profile.lastName} />
          </div>
          <ProfileField label="Email" value={profile.email} />
          <ProfileField label="Discord" value={profile.discord} />
          <div className="grid grid-cols-2 gap-5">
            <ProfileField
              label="Birthday"
              value={formatDate(profile.birthday)}
            />
            <ProfileField label="Gender" value={profile.gender} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <ProfileField label="State" value={profile.state} />
            <ProfileField label="Country" value={profile.country} />
          </div>
          <ProfileField label="Member Since" value={formatDate(profile.joined)} />
        </div>
      )}
    </div>
  );
}
