import { redirect } from "next/navigation";

/** Alias path; canonical page lives at /review-hours. */
export default function DashboardReviewHoursRedirect() {
  redirect("/review-hours");
}
