import { auth } from "@/auth";
import { getPersonById } from "@/lib/airtable/people";

export function isAdminDirectorRole(role: string | null | undefined) {
  return role === "Executive Director" || role === "Track Director";
}

export async function requireAdminDirector() {
  const session = await auth();
  const personId = session?.user?.personId || "";
  if (!personId) return null;
  const person = await getPersonById(personId);
  return person && isAdminDirectorRole(person.role)
    ? { personId, role: person.role, person }
    : null;
}
