import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata = {
  title: "Sign in",
};

export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Someone who is already signed in has nothing to do here.
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return children;
}
