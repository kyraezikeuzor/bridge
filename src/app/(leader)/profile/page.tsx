"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Button, Input } from "@omelora/sunrise";
import { useToast } from "@/components/ToastProvider";
import { useCachedResource } from "@/lib/useCachedResource";

type Profile = {
  id: string;
  role: string | null;
  firstName: string;
  lastName: string;
  email: string;
  discord: string;
  birthday: string;
  gender: string;
  state: string;
  country: string;
  joined: string;
};

const EMPTY_PROFILE: Profile = {
  id: "",
  role: null,
  firstName: "",
  lastName: "",
  email: "",
  discord: "",
  birthday: "",
  gender: "",
  state: "",
  country: "",
  joined: "",
};

const GENDER_OPTIONS = ["Female", "Male", "Other"];
const COUNTRY_OPTIONS = ["United States", "Canada", "Nigeria"];

/**
 * Airtable may hold a value this app's list doesn't offer. Surface it as an
 * option instead of letting the select silently rewrite it on the next save.
 */
function withCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

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
  const { data: session, status: sessionStatus } = useSession();
  const { push: toast } = useToast();
  const personId = session?.user?.personId || "";

  const {
    data,
    setData,
    loading,
    refreshing,
    refresh,
  } = useCachedResource<Profile>(
    `profile:${personId || session?.user?.email || "anon"}`,
    async () => {
      const res = await fetch("/api/profile");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load profile");
      return body as Profile;
    },
    {
      enabled: sessionStatus === "authenticated",
      onError: (err) => console.error("[profile]", err),
    }
  );

  const profile = data ?? {
    ...EMPTY_PROFILE,
    firstName: session?.user?.firstName ?? "",
    lastName: session?.user?.lastName ?? "",
    email: session?.user?.email ?? "",
  };

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [discord, setDiscord] = useState(profile.discord);
  const [birthday, setBirthday] = useState(profile.birthday);
  const [gender, setGender] = useState(profile.gender);
  const [state, setState] = useState(profile.state);
  const [country, setCountry] = useState(profile.country);

  // Keep the (closed) edit form in step with whatever the fetch returned.
  useEffect(() => {
    if (!data || editing) return;
    setDiscord(data.discord);
    setBirthday(data.birthday);
    setGender(data.gender);
    setState(data.state);
    setCountry(data.country);
  }, [data, editing]);

  const startEdit = () => {
    setDiscord(profile.discord);
    setBirthday(profile.birthday);
    setGender(profile.gender);
    setState(profile.state);
    setCountry(profile.country);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord, birthday, gender, state, country }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save profile");

      setData(body as Profile);
      setEditing(false);
      toast("Profile updated");
    } catch (err) {
      console.error("[profile] save failed", err);
      toast(
        err instanceof Error ? err.message : "Failed to save profile",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const showSkeleton = sessionStatus === "loading" || (loading && !data);

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
            onClick={() => refresh()}
            disabled={refreshing || showSkeleton}
          >
            Refresh
            <RefreshCw
              className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              onClick={startEdit}
              disabled={showSkeleton}
            >
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {showSkeleton ? (
        <div className="rounded-xl border-2 border-border bg-background p-6 text-sm text-muted-foreground">
          Loading your profile…
        </div>
      ) : editing ? (
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
              <option value="">—</option>
              {withCurrent(GENDER_OPTIONS, gender).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
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
                <option value="">—</option>
                {withCurrent(COUNTRY_OPTIONS, country).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
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
