import { PageShell } from "@omelora/sunrise";
import { AppSidebar } from "@/components/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      constrain={false}
      sidebar={<AppSidebar />}
      className="bg-background"
    >
      <div className="min-h-screen w-full bg-background">{children}</div>
    </PageShell>
  );
}
