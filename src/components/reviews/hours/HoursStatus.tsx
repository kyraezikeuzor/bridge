import { Badge } from "@omelora/sunrise";

export function HoursStatus({ status }: { status: string }) {
  if (status === "Approved") return <Badge variant="success">Approved</Badge>;
  if (status === "Rejected") {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}
