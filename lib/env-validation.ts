import { logger } from './logger';

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
];

const OPTIONAL_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'COMPOSIO_API_KEY',
  'ENCRYPTION_KEY',
  'STRIPE_BILLING_WEBHOOK_SECRET',
  'STRIPE_CHARGES_WEBHOOK_SECRET',
  'CRON_SECRET',
];

export function validateEnv() {
  const missing: string[] = [];
  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) missing.push(v);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  const optional: Record<string, boolean> = {};
  for (const v of OPTIONAL_VARS) {
    optional[v] = !!process.env[v];
  }
  logger.info('Environment validated', {
    required: 'all present',
    optional,
  });
}
