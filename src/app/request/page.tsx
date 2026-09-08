import { ClipboardList, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { HOURS_REQUEST_FORM_URL } from "@/data/session";
import { textColor, typography } from "@/styles/typography";

export const metadata = {
  title: "Missing Hours?",
};

export default function RequestHoursPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <div>
          <h1 className={`${typography.pageTitle} ${textColor.primary}`}>
            Missing hours?
          </h1>
          <p className={`mt-2 ${typography.body} ${textColor.secondary}`}>
            Use this form only when completed volunteer hours are missing from
            your Hours Summary. For a claimed activity, submit work from My
            Activities instead. Questions? Email{" "}
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
          href={HOURS_REQUEST_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <Card
            variant="outline"
            className="border-2 transition-colors hover:border-[#9A9A9A] hover:bg-muted/50"
          >
            <CardContent className="flex items-center gap-5 p-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary">
                <ClipboardList className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
              <p className={`${typography.cardTitle} ${textColor.primary}`}>
                  Report missing hours
                </p>
              <p className={`mt-0.5 ${typography.metadata} ${textColor.secondary}`}>
                  Open the legacy form to request a review of missing credit
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
