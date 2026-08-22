import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/email";
import { getPersonByEmailDirect } from "@/lib/airtable";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      // Keep provider id as "email" so client can call signIn("email", …)
      id: "email",
      name: "Email",
      apiKey: process.env.RESEND_API_KEY,
      from: "Omelora <team@omelora.org>",
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail(identifier, url);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * After magic-link verification: require a People row.
     * Returning a path blocks the session and redirects there.
     * When the user is only requesting the email (verificationRequest), always allow.
     */
    async signIn({ user, email }) {
      // Allow sending the magic link to any address; gate on click/callback.
      if (email?.verificationRequest) {
        return true;
      }

      const address = user.email?.trim();
      if (!address) return false;

      const person = await getPersonByEmailDirect(address);
      if (!person) {
        console.log(
          `[auth] no People record for "${address}" — blocking sign-in`
        );
        return "/auth/no-profile";
      }

      console.log(
        `[auth] People match for "${address}" (id: ${person.id}, role: ${person.role})`
      );
      return true;
    },

    async jwt({ token, user, trigger }) {
      // Populate Bridge profile fields on initial sign-in
      if (user?.email || (trigger === "signIn" && token.email)) {
        const email = (user?.email ?? token.email)?.toString().trim();
        if (email) {
          const person = await getPersonByEmailDirect(email);
          if (person) {
            token.personId = person.id;
            token.firstName = person.fields["First Name"]?.trim() ?? "";
            token.lastName = person.fields["Last Name"]?.trim() ?? "";
            token.role = person.role;
            token.email = email;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email =
          typeof token.email === "string" ? token.email : session.user.email;
        session.user.firstName =
          typeof token.firstName === "string" ? token.firstName : "";
        session.user.lastName =
          typeof token.lastName === "string" ? token.lastName : "";
        session.user.role =
          typeof token.role === "string" || token.role === null
            ? token.role
            : null;
        session.user.personId =
          typeof token.personId === "string" ? token.personId : "";
        session.user.name =
          [session.user.firstName, session.user.lastName]
            .filter(Boolean)
            .join(" ") || session.user.name;
      }
      return session;
    },
  },
});
