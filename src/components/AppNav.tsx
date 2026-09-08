import Link from "next/link";
import { textColor, typography } from "@/styles/typography";

const LOGO_URL =
  "https://images.fillout.com/orgid-737092/flowpublicid-uti4bix9xv/widgetid-default/uLyhUKhp6oTaSjVFoLd2M8/LOGO.png";

export function AppNav({ active = "activities" }: { active?: "activities" }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/activities" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_URL}
            alt="Omelora"
            className="h-9 w-9 rounded-lg object-cover"
          />
          <span className={`${typography.sectionTitle} ${textColor.primary}`}>
            Omelora
            <br className="hidden sm:block" /> Bridge
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/activities"
            className={`rounded-lg px-4 py-2 ${typography.button} transition-colors ${
              active === "activities"
                ? "bg-muted text-foreground shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.08)]"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            Activities
          </Link>
          <Link
            href="/"
            className={`rounded-lg px-4 py-2 ${typography.button} ${textColor.secondary} transition-colors hover:bg-muted/60 hover:text-foreground`}
          >
            Sign out
          </Link>
        </nav>
      </div>
    </header>
  );
}
