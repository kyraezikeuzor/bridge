import { Button, Card, CardContent } from "@omelora/sunrise";

const APPLY_URL = "https://form.fillout.com/t/2VfsyEfiduus";

export const metadata = {
  title: "No Profile Found",
};

export default function NoProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sunrise-50 px-4 py-10 sm:px-6">
      <Card
        variant="elevated"
        className="w-full max-w-[440px] border border-border shadow-lg"
      >
        <CardContent className="flex flex-col gap-6 p-2 sm:p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              We couldn&apos;t find a volunteer profile for this email
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bridge is only available to approved Omelora volunteers. If you
              haven&apos;t applied yet, you can start an application below. If
              you recently got accepted, try signing in with the same email you
              used on your application.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a href={APPLY_URL} target="_blank" rel="noopener noreferrer">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full font-semibold shadow-sm"
              >
                Apply
              </Button>
            </a>
            <a href="/signin">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full font-medium"
              >
                Back to sign in
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
