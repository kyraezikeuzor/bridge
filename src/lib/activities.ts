import { activities, profiles } from "@/data/mock";
import type {
  Activity,
  ActivityStatus,
  ActivityTrack,
  Profile,
  SignUp,
} from "@/lib/types";
import { ACTIVITY_TRACKS } from "@/lib/types";

export function slotsFilled(signUps: SignUp[]): number {
  return signUps.reduce((sum, s) => sum + s.spots, 0);
}

export function activityStatus(activity: Activity, signUps?: SignUp[]): ActivityStatus {
  const filled = slotsFilled(signUps ?? activity.signUps);
  return filled >= activity.slotsTotal ? "full" : "open";
}

export function getActivityBySlug(slug: string): Activity | undefined {
  return activities.find((a) => a.slug === slug);
}

export function getActivitiesByTrack(track: ActivityTrack): Activity[] {
  return activities.filter((a) => a.track === track);
}

export function getAllTracks(): ActivityTrack[] {
  return [...ACTIVITY_TRACKS];
}

export function findProfileByEmail(email: string): Profile | undefined {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  return profiles.find((p) => p.email.toLowerCase() === normalized);
}

export function formatDeadline(iso: string): string {
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

export function displayName(signUp: SignUp): string {
  return `${signUp.firstName} ${signUp.lastInitial}.`;
}
