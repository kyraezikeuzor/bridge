import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
      firstName: string;
      lastName: string;
      /** Airtable Latest Role (e.g. "Volunteer", "Executive Director") */
      role: string | null;
      /** Airtable People record id */
      personId: string;
    } & DefaultSession["user"];
  }

  interface User {
    firstName?: string;
    lastName?: string;
    role?: string | null;
    personId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    firstName?: string;
    lastName?: string;
    role?: string | null;
    personId?: string;
  }
}
