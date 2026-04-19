import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "@/lib/sentry-scrub";

// BSRS Ch 8 P3c — release tag is channel-prefixed so canary and stable
// errors can be segmented in Sentry via release filters. Client bundle
// can only read NEXT_PUBLIC_* env vars, so operator must set both
// DEPLOY_CHANNEL and NEXT_PUBLIC_DEPLOY_CHANNEL on each Vercel
// deployment (P3b). NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is exposed via
// Vercel's System Environment Variables panel.
const DEPLOY_CHANNEL = process.env.NEXT_PUBLIC_DEPLOY_CHANNEL || "stable";
const COMMIT_SHA =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `bs@${DEPLOY_CHANNEL}-${COMMIT_SHA}`,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    return scrubPii(event);
  },
});
