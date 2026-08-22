import { PageShell } from "@omelora/sunrise";
import { ActivityBoardCard } from "@/components/ActivityBoardCard";
import { AppNav } from "@/components/AppNav";
import { getActivitiesByTrack, getAllTracks } from "@/lib/activities";

export const metadata = {
  title: "Activities",
};

export default function ActivitiesPage() {
  const tracks = getAllTracks();

  return (
    <PageShell constrain={false} header={<AppNav active="activities" />}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal text-[#3F3F3F]">
            Activities
          </h1>
          <p className="max-w-2xl text-[#747474]">
            Browse open volunteer activities by track. Claim a card to view
            instructions and sign up.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {tracks.map((track) => {
            const columnActivities = getActivitiesByTrack(track);
            return (
              <section key={track} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2.5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    {track}
                  </h2>
                  <span className="text-xs font-medium text-muted-foreground">
                    {columnActivities.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {columnActivities.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      No activities
                    </p>
                  ) : (
                    columnActivities.map((activity) => (
                      <ActivityBoardCard key={activity.id} activity={activity} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
