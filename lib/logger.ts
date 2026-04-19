import { Logger } from '@logtail/next';

// Singleton logger for BenefitsSafe.
// Reads NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN + NEXT_PUBLIC_BETTER_STACK_INGESTING_URL
// from environment automatically. When not set (local dev), falls back to console output.
const baseLogger = new Logger({ source: 'benefitssafe' });

// BSRS Ch 8 P3c — every log line carries deploy_channel + commit_sha
// so canary vs stable can be filtered in Better Stack dashboards and
// alert rules. `.with()` returns a child logger that merges these
// fields into every log event; the child shares the parent's buffer,
// so flushLogs() below still drains everything. DEPLOY_CHANNEL is set
// per-deployment by Vercel (P3b); unset defaults to "stable".
export const logger = baseLogger.with({
  deploy_channel: process.env.DEPLOY_CHANNEL || 'stable',
  commit_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
});

// Must be called in server contexts (API routes, cron jobs) before the response
// is returned, or buffered log events will be silently dropped.
export async function flushLogs(): Promise<void> {
  await logger.flush();
}
