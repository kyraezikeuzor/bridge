import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@omelora/sunrise";
import {
  activityStatus,
  formatDeadline,
  slotsFilled,
} from "@/lib/activities";
import type { Activity } from "@/lib/types";

export function ActivityBoardCard({ activity }: { activity: Activity }) {
  const filled = slotsFilled(activity.signUps);
  const status = activityStatus(activity);

  return (
    <Link href={`/activities/${activity.slug}`} className="block">
      <Card
        variant="outline"
        className="h-full border-2 transition-colors hover:border-primary"
      >
        <CardHeader className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{activity.title}</CardTitle>
            <Badge variant={status === "full" ? "warning" : "success"} size="sm">
              {status === "full" ? "Full" : "Open"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary" size="sm">
              {activity.type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {activity.description}
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-right font-medium text-foreground">
                {activity.location}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="text-right font-medium text-foreground">
                {formatDeadline(activity.deadline)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Slots</dt>
              <dd className="text-right font-medium text-foreground">
                {filled}/{activity.slotsTotal} filled
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}
