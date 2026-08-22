import { redirect } from "next/navigation";

/** Alias path requested for directors; canonical page lives at /review-applications. */
export default function DashboardReviewApplicationsRedirect() {
  redirect("/review-applications");
}
