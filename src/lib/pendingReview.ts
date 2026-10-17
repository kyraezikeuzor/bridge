import { getApplications } from "@/lib/applicationsCache";
import { getAllActivities } from "@/lib/activitiesCache";
import { getHoursRequests } from "@/lib/hoursCache";
import type { PendingReviewCounts } from "@/lib/airtable";
import {
  isAssignedToReviewer,
  canReviewHoursAssignment,
  resolveReviewerIdentity,
  type ReviewerIdentity,
} from "@/lib/reviewAssignee";

/**
 * Director home "Pending Your Review" counts for items assigned to this director.
 * Applications Status = Submitted AND Assignee includes the user's email.
 * Hours Status = Submitted AND Assignee includes the user's email.
 */
export async function getPendingReviewCounts(
  reviewer: ReviewerIdentity
): Promise<PendingReviewCounts> {
  if (!reviewer.email && !reviewer.personId) {
    return { applications: 0, hours: 0, activitiesInProgress: 0 };
  }

  const resolvedReviewer = await resolveReviewerIdentity(reviewer);

  const [applications, hours, activities] = await Promise.all([
    getApplications("Submitted"),
    getHoursRequests("Submitted"),
    getAllActivities(),
  ]);

  const assignedApps = applications.filter((app) =>
    isAssignedToReviewer(app.assigneeIds, resolvedReviewer)
  );
  const assignedHours = hours.filter((row) =>
    canReviewHoursAssignment(row.assigneeIds, resolvedReviewer)
  );
  // Activities aren't per-reviewer assigned — count is org-wide.
  const activitiesInProgress = activities.filter(
    (activity) => activity.status === "Active"
  ).length;

  console.log(
    `[pendingReview] applications=${assignedApps.length}/${applications.length} hours=${assignedHours.length}/${hours.length} activitiesInProgress=${activitiesInProgress}`
  );

  return {
    applications: assignedApps.length,
    hours: assignedHours.length,
    activitiesInProgress,
  };
}
