import { redirect } from "next/navigation";

/** Legacy bookmark kept while Bridge moves claims into the Activities area. */
export default function ClaimActivitiesPage() {
  redirect("/activities");
}
