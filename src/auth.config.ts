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
