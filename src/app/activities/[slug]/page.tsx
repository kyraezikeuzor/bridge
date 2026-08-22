import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageShell,
} from "@omelora/sunrise";
import { AppNav } from "@/components/AppNav";
import { SignUpPanel } from "@/components/SignUpPanel";
import { activities } from "@/data/mock";
import {
  activityStatus,
  formatDeadline,
  getActivityBySlug,
  slotsFilled,
} from "@/lib/activities";

interface ActivityDetailPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return activities.map((activity) => ({ slug: activity.slug }));
}

export function generateMetadata({ params }: ActivityDetailPageProps) {
  const activity = getActivityBySlug(params.slug);
  return {
    title: activity ? activity.title : "Activity",
  };
}

export default function ActivityDetailPage({ params }: ActivityDetailPageProps) {
  const activity = getActivityBySlug(params.slug);
  if (!activity) notFound();

  const filled = slotsFilled(activity.signUps);
  const status = activityStatus(activity);

  return (
    <PageShell constrain={false} header={<AppNav active="activities" />}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/activities"
          className="mb-6 inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to activities
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{activity.track}</Badge>
                <Badge variant="outline">{activity.type}</Badge>
                <Badge variant={status === "full" ? "warning" : "success"}>
                  {status === "full" ? "Full" : "Open"}
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {activity.title}
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                {activity.description}
              </p>
            </div>

            <Card variant="outline">
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>
                  Hours, deadline, and where this activity takes place.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Hours
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-foreground">
                      {activity.hours}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Deadline
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-foreground">
                      {formatDeadline(activity.deadline)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Slots
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-foreground">
                      {filled}/{activity.slotsTotal}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Location
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {activity.location}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {activity.instructions}
                </p>
              </CardContent>
            </Card>

            <Card variant="muted">
              <CardHeader>
                <CardTitle>Next steps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground">
                  {activity.nextSteps}
                </p>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SignUpPanel activity={activity} />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
