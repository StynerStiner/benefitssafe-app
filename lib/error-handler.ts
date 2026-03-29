import * as Sentry from "@sentry/nextjs";

export function captureApiError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, { contexts: { api: context } });
}
