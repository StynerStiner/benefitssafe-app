// Cron endpoint auth — shared across every app/api/cron/* route.
//
// Scheduling was migrated off Vercel cron (Hobby plan blocks sub-daily
// schedules) onto a Cloudflare Worker (benefitssafe-cron) that calls
// these endpoints with `Authorization: Bearer <CRON_SECRET>`. This
// helper centralises the validation so every route uses the same
// fail-closed logic: missing env var, missing header, malformed
// header, or wrong token → 401.

export function validateCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === expected;
}
