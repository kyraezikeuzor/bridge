"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  CircleCheck,
  ClipboardList,
  Clock,
  Home,
  LogOut,
  Mail,
  PlusCircle,
  Upload,
  UserCog,
  Zap,
} from "lucide-react";
import { Button } from "@omelora/sunrise";
import { isLeaderRole } from "@/lib/roles";

const LOGO_URL =
  "https://images.fillout.com/orgid-737092/flowpublicid-uti4bix9xv/widgetid-default/uLyhUKhp6oTaSjVFoLd2M8/LOGO.png";

const volunteerNav = [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "Claim Activities", icon: Zap, path: "/claim" },
  { label: "Submit Work", icon: Upload, path: "/submit-work" },
  { label: "Request Hours", icon: PlusCircle, path: "/request" },
  { label: "Hours Summary", icon: ClipboardList, path: "/summary" },
  { label: "My Profile", icon: UserCog, path: "/profile" },
];

const leaderNav = [
  { label: "Home", icon: Home, path: "/dashboard" },
  { label: "Review Applications", icon: CircleCheck, path: "/review-applications" },
  { label: "Review Hours", icon: Clock, path: "/review-hours" },
  { label: "Review Activities", icon: Zap, path: "/review-activities" },
  { label: "Volunteer Roundup", icon: Mail, path: "/roundup" },
  { label: "My Profile", icon: UserCog, path: "/profile" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const firstName = session?.user?.firstName ?? "";
  const lastName = session?.user?.lastName ?? "";
  const email = session?.user?.email ?? "";
  const role = session?.user?.role ?? null;

  const isLeader = isLeaderRole(role);
  const navItems = isLeader ? leaderNav : volunteerNav;
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Member";

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-3 px-6 pb-4 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_URL}
          alt="Omelora"
          className="h-10 w-10 rounded-lg object-cover"
        />
        <div className="min-w-0">
          <span className="block text-xl font-bold leading-tight text-[#3F3F3F]">
            Bridge
          </span>
          <span className="block text-sm text-[#747474]">
            {isLeader ? "Directors Portal" : "Volunteer Portal"}
          </span>
        </div>
      </div>

      <div className="mx-4 mb-3 border-b border-border" />

      <nav className="flex flex-1 flex-col gap-1.5 px-4">
        {navItems.map((item) => {
          const active =
            item.path === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/home"
              : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex min-h-[48px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-base transition-colors ${
                active
                  ? "bg-[#F7F7F7] font-medium text-[#3F3F3F] shadow-[inset_0_2px_4px_rgba(0,0,0,0.10),inset_0_-1px_0_rgba(255,255,255,0.9),0_1px_0_rgba(255,255,255,0.9)]"
                  : "font-medium text-[#747474] hover:bg-[#F1F1F1]"
              }`}
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${
                  active ? "text-[#3F3F3F]" : "text-[#747474]"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2.5 border-t border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 bg-muted/40"
          onClick={() => signOut({ callbackUrl: "/signin" })}
        >
          Sign out
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
