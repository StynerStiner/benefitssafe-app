import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,
  beforeSend(event) {
    // Scrub sensitive data from headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }
    // Scrub sensitive data from request body
    if (event.request?.data && typeof event.request.data === "string") {
      try {
        const parsed = JSON.parse(event.request.data);
        delete parsed.password;
        delete parsed.passwordHash;
        delete parsed.ssn;
        delete parsed.ssnLast4;
        delete parsed.cardNumber;
        delete parsed.token;
        delete parsed.mfaSecret;
        event.request.data = JSON.stringify(parsed);
      } catch {
        // Not JSON, leave as-is
      }
    }
    return event;
  },
});
