import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchAllActivities, fetchClaimedActivitiesForPerson } from "@/lib/airtable";
import { StartActivity } from "./StartActivity";

export const dynamic = "force-dynamic";

/**
 * Landing page for "Continue in Bridge" on activities.omelora.org.
 * Already signed up: go straight to the activity workspace and its forms.
 * Not yet: confirm with one click, then go to the same workspace.
 */
export default async function StartPage({ params }: { params: { activityId: string } }) {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) redirect(`/signin?callbackUrl=${encodeURIComponent(`/start/${params.activityId}`)}`);

  const [claimed, activities] = await Promise.all([
    fetchClaimedActivitiesForPerson(personId),
    fetchAllActivities(),
  ]);
  const existing = claimed.find((claim) => claim.activityId === params.activityId);
  if (existing) redirect(`/activities/${encodeURIComponent(existing.id)}`);

  const activity = activities.find((item) => item.id === params.activityId);
  return (
    <StartActivity
      activityId={params.activityId}
      activity={activity ? { name: activity.name, description: activity.description, hours: activity.hoursValue, status: activity.status } : null}
    />
  );
}
