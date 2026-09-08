import { PageShell } from "@omelora/sunrise";
import { AppSidebar, MobileNavigation } from "@/components/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
    <PageShell
      constrain={false}
      sidebar={<AppSidebar />}
      className="bg-background"
    >
      <div className="min-h-screen w-full bg-background pb-24 md:pb-0">{children}</div>
    </PageShell>
    <MobileNavigation />
    </>
  );
}
