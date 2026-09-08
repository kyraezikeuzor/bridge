"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { Button } from "@omelora/sunrise";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { profileDraft, type Profile, type ProfileDraft } from "@/components/profile/types";
import { useToast } from "@/components/ToastProvider";
import { useCachedResource } from "@/lib/useCachedResource";
import { textColor, typography } from "@/styles/typography";

const EMPTY_PROFILE: Profile = {
  id: "", role: null, firstName: "", lastName: "", email: "", discord: "",
  birthday: "", gender: "", state: "", country: "", joined: "",
};

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const { push: toast } = useToast();
  const personId = session?.user?.personId || "";
  const { data, setData, loading, refreshing, refresh } = useCachedResource<Profile>(
    `profile:${personId || session?.user?.email || "anon"}`,
    async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to load profile");
      return (await response.json()) as Profile;
    },
    { enabled: sessionStatus === "authenticated", onError: (error) => console.error("[profile]", error) }
  );
  const profile = data ?? {
    ...EMPTY_PROFILE,
    firstName: session?.user?.firstName ?? "",
    lastName: session?.user?.lastName ?? "",
    email: session?.user?.email ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraft(profile));

  useEffect(() => {
    if (data && !editing) setDraft(profileDraft(data));
  }, [data, editing]);

  const startEdit = () => {
    setDraft(profileDraft(profile));
    setEditing(true);
  };
  const changeDraft = (field: keyof ProfileDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error("Failed to save profile");
      setData((await response.json()) as Profile);
      setEditing(false);
      toast("Profile updated");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };
  const showSkeleton = sessionStatus === "loading" || (loading && !data);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex items-center justify-between gap-4">
        <h1 className={`${typography.pageTitle} ${textColor.primary}`}>My Profile</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className={typography.buttonSecondary} onClick={() => void refresh()} disabled={refreshing || showSkeleton}>
            Refresh <RefreshCw className={`ml-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {!editing ? <Button type="button" variant="outline" size="sm" className={typography.buttonSecondary} onClick={startEdit} disabled={showSkeleton}>Edit</Button> : null}
        </div>
      </header>
      {showSkeleton ? <div className="rounded-xl border-2 border-border bg-background p-6 text-sm text-muted-foreground">Loading your profile…</div> : editing ? (
        <ProfileForm profile={profile} draft={draft} saving={saving} onChange={changeDraft} onSave={() => void save()} onCancel={() => setEditing(false)} />
      ) : <ProfileCard profile={profile} />}
    </div>
  );
}
