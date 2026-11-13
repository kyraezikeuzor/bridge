import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma / Resend / Node-only imports).
 * Used by middleware. Full config with adapter + Email provider lives in auth.ts.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    /**
     * Where people land after sign-in. Always /dashboard, except a
     * /start/<activity> link from the Activities board, which keeps
     * them on that activity, and /signin after sign-out. This also fixes links already sitting in
     * inboxes that point at "/".
     */
    redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        // /signin is allowed for sign-out. A signed-in person who reaches
        // /signin is sent on to /dashboard by app/signin/layout.tsx.
        if (
          target.origin === baseUrl &&
          (target.pathname.startsWith("/start/") || target.pathname === "/signin")
        ) {
          return target.toString();
        }
      } catch {}
      return `${baseUrl}/dashboard`;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/signin") ||
        pathname.startsWith("/auth/") ||
        pathname.startsWith("/api/auth") ||
        // These handlers authenticate the raw body with the Monsoon HMAC.
        pathname === "/api/hours/external" ||
        pathname === "/api/contributions/external";

      if (isPublic) return true;
      return !!auth?.user;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
