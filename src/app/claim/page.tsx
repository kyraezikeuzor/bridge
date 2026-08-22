import { ExternalLink, Zap } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { CLAIM_ACTIVITIES_URL } from "@/data/session";

export const metadata = {
  title: "Claim Activities",
};

export default function ClaimActivitiesPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F] sm:text-3xl">
            Claim Activities
          </h1>
          <p className="mt-2 leading-relaxed text-[#747474]">
            Browse open volunteer activities and claim the ones you want to
            complete. Questions? Email{" "}
            <a
              href="mailto:volunteer@omelora.org"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              volunteer@omelora.org
            </a>
            .
          </p>
        </div>

        <a
          href={CLAIM_ACTIVITIES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <Card
            variant="outline"
            className="border-2 transition-colors hover:border-primary"
          >
            <CardContent className="flex items-center gap-5 p-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">
                  Volunteer Activities Board
                </p>
                <p className="mt-0.5 font-medium text-muted-foreground">
                  Open activities.omelora.org to claim a task
                </p>
              </div>
              <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </a>
      </div>
    </AppShell>
  );
}
