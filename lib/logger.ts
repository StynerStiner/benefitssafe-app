import { Logger } from '@logtail/next';

// Singleton logger for BenefitsSafe.
// Reads NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN + NEXT_PUBLIC_BETTER_STACK_INGESTING_URL
// from environment automatically. When not set (local dev), falls back to console output.
export const logger = new Logger({ source: 'benefitssafe' });

// Must be called in server contexts (API routes, cron jobs) before the response
// is returned, or buffered log events will be silently dropped.
export async function flushLogs(): Promise<void> {
  await logger.flush();
}
