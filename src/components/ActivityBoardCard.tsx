import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@omelora/sunrise";
import {
  activityStatus,
  formatDeadline,
  slotsFilled,
} from "@/lib/activities";
import type { Activity } from "@/lib/types";
import { textColor, typography } from "@/styles/typography";

export function ActivityBoardCard({ activity }: { activity: Activity }) {
  const filled = slotsFilled(activity.signUps);
  const status = activityStatus(activity);

  return (
    <Link href={`/activities/${activity.slug}`} className="block">
      <Card
        variant="outline"
        className="h-full border-2 transition-colors hover:border-[#9A9A9A] hover:bg-muted/50"
      >
        <CardHeader className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className={typography.cardTitle}>{activity.title}</CardTitle>
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
          <p className={`line-clamp-3 ${typography.bodySmall} ${textColor.secondary}`}>
            {activity.description}
          </p>
          <dl className={`space-y-1.5 ${typography.metadata}`}>
            <div className="flex justify-between gap-3">
              <dt className={textColor.secondary}>Location</dt>
              <dd className={`text-right font-medium ${textColor.primary}`}>
                {activity.location}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={textColor.secondary}>Deadline</dt>
              <dd className={`text-right font-medium ${textColor.primary}`}>
                {formatDeadline(activity.deadline)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className={textColor.secondary}>Slots</dt>
              <dd className={`text-right font-medium ${textColor.primary}`}>
                {filled}/{activity.slotsTotal} filled
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}
