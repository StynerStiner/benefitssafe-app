import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "@/lib/sentry-scrub";

// BSRS Ch 8 P3c — release tag is channel-prefixed so canary and stable
// errors can be segmented in Sentry via release filters. DEPLOY_CHANNEL
// is set per-deployment by Vercel (P3b); unset defaults to "stable".
const DEPLOY_CHANNEL = process.env.DEPLOY_CHANNEL || "stable";
const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `bs@${DEPLOY_CHANNEL}-${COMMIT_SHA}`,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,
  // All PII scrubbing lives in lib/sentry-scrub.ts so server/client/edge
  // stay in sync. Any new sensitive field must be added there, not here.
  beforeSend(event) {
    return scrubPii(event);
  },
});
