import { Badge } from "@omelora/sunrise";
import type { ReviewActivityStatus } from "@/lib/leader-types";

export function ActivityStatus({ status }: { status: ReviewActivityStatus }) {
  if (status === "Active") return <Badge variant="success">Active</Badge>;
  if (status === "Closed") return <Badge variant="outline">Closed</Badge>;
  return <Badge variant="default">Submitted</Badge>;
}
