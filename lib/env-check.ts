const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
];

// These become required in production — app refuses to start without them
const REQUIRED_IN_PRODUCTION = [
  "ENCRYPTION_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const RECOMMENDED_VARS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
  "SENTRY_DSN",
];

export function validateEnvironment(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  // In production, these are hard requirements — refuse to start without them
  for (const v of REQUIRED_IN_PRODUCTION) {
    if (!process.env[v]) {
      if (isProduction) {
        missing.push(v);
      } else {
        warnings.push(v);
      }
    }
  }

  for (const v of RECOMMENDED_VARS) {
    if (!process.env[v]) warnings.push(v);
  }

  if (missing.length > 0) {
    console.error(`CRITICAL: Missing required environment variables: ${missing.join(", ")}`);
  }
  if (warnings.length > 0) {
    console.warn(`WARNING: Missing recommended environment variables: ${warnings.join(", ")}`);
  }

  return { valid: missing.length === 0, missing, warnings };
}
