// Returns exactly 2 uppercase characters (or "??" if no name).
// Uses the FIRST and LAST whitespace-separated segments — so
// "Mary Jane Watson" -> "MW", "Prince" -> "PR", null/"" -> "??".
export function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return (parts[0].substring(0, 2) || "??").toUpperCase().padEnd(2, parts[0][0] || "?");
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
