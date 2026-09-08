import { Badge } from "@omelora/sunrise";

export function ApplicationStatus({ status }: { status: string }) {
  if (status === "Accepted") return <Badge variant="success">Accepted</Badge>;
  if (status === "Rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="default">{status || "Submitted"}</Badge>;
}
