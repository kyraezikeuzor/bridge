import { ExternalLink, Upload } from "lucide-react";
import { Card, CardContent } from "@omelora/sunrise";
import { AppShell } from "@/components/AppShell";
import { SUBMIT_WORK_FORM_URL } from "@/data/session";

export const metadata = {
  title: "Submit Work",
};

export default function SubmitWorkPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-[#3F3F3F] sm:text-3xl">
            Submit Work
          </h1>
          <p className="mt-2 leading-relaxed text-[#747474]">
            Turn in the work you completed for an activity. Questions? Email{" "}
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
          href={SUBMIT_WORK_FORM_URL}
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
                <Upload className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">
                  Submission Form
                </p>
                <p className="mt-0.5 font-medium text-muted-foreground">
                  Upload a file or write up the work you completed
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
