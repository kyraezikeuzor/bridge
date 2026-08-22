import { redirect } from "next/navigation";

export default function LeaderHomeRedirect() {
  redirect("/dashboard");
}
