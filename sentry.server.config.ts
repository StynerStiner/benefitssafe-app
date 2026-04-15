import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,
  // All PII scrubbing lives in lib/sentry-scrub.ts so server/client/edge
  // stay in sync. Any new sensitive field must be added there, not here.
  beforeSend(event) {
    return scrubPii(event);
  },
});
