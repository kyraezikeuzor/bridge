import { LeaderShell } from "@/components/leader/LeaderShell";

export default function LeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LeaderShell>{children}</LeaderShell>;
}
