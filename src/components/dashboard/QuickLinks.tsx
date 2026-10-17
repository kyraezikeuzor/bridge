import Link from "next/link";
import { useId } from "react";
import { BarChart3, BookOpen, ClipboardList, Clock, ExternalLink, FileText, Globe, PlusCircle, UserCog, Zap } from "lucide-react";
import { volunteerQuickLinks } from "@/data/session";
import { textColor, typography } from "@/styles/typography";

function DiscordIcon({ className }: { className?: string }) {
  const maskId = useId();
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <defs><mask id={maskId}><rect width="24" height="24" fill="white" /><ellipse cx="8.2" cy="12.4" rx="1.55" ry="1.8" fill="black" /><ellipse cx="15.8" cy="12.4" rx="1.55" ry="1.8" fill="black" /></mask></defs>
    <path mask={`url(#${maskId})`} d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
  </svg>;
}

const volunteerIconColors = {
  discord: "bg-[#5865F2] text-white",
  zap: "bg-orange-500 text-white",
  book: "bg-green-500 text-white",
  globe: "bg-sky-500 text-white",
  clipboard: "bg-violet-500 text-white",
};

function VolunteerIcon({ icon }: { icon: "discord" | "globe" | "book" | "clipboard" | "zap" }) {
  const className = "h-5 w-5";
  if (icon === "discord") return <DiscordIcon className={className} />;
  if (icon === "globe") return <Globe className={className} />;
  if (icon === "clipboard") return <ClipboardList className={className} />;
  if (icon === "zap") return <Zap className={className} />;
  return <BookOpen className={className} />;
}

const LEADER_LINKS = [
  { href: "/review-applications", title: "Review Applications", description: "Approve or reject volunteer applications", Icon: FileText },
  { href: "/review-hours", title: "Review Hours", description: "Approve or reject hours requests", Icon: Clock },
  { href: "/create-activity", title: "Create Activity", description: "Create a volunteer activity", Icon: PlusCircle },
  { href: "/insights", title: "Impact & Members", description: "View volunteer participation and hours", Icon: BarChart3 },
  { href: "/profile", title: "Update My Profile", description: "Keep your information up to date", Icon: UserCog },
];

const cardClass = "group flex items-center gap-5 rounded-xl border-2 border-border bg-background p-5 transition-[border-color,background-color,opacity] hover:border-[#9A9A9A] hover:bg-muted/50 sm:p-6";

export function QuickLinks({ leader }: { leader: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={`px-1 uppercase ${typography.status} ${textColor.secondary}`}>{leader ? "Director actions" : "Quick Links"}</h3>
      {leader
        ? LEADER_LINKS.map(({ href, title, description, Icon }) => (
            <Link key={href} href={href} className={cardClass}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-5 w-5 text-foreground" /></div>
              <div className="min-w-0 flex-1"><p className={`${typography.cardTitle} ${textColor.primary}`}>{title}</p><p className={`mt-0.5 ${typography.metadata} ${textColor.secondary}`}>{description}</p></div>
            </Link>
          ))
        : volunteerQuickLinks.map((item) => (
            <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${volunteerIconColors[item.icon]}`}><VolunteerIcon icon={item.icon} /></div>
              <div className="min-w-0 flex-1"><p className={`${typography.cardTitle} ${textColor.primary}`}>{item.title}</p><p className={`mt-0.5 ${typography.metadata} ${textColor.secondary}`}>{item.description}</p></div>
              <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </a>
          ))}
    </section>
  );
}
