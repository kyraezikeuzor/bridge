/**
 * Map Airtable "Latest Role" to Bridge app nav role.
 */
export function isLeaderRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return (
    r.includes("director") ||
    r.includes("leader") ||
    r.includes("admin") ||
    r.includes("chapter")
  );
}
