// Sentry PII scrubber.
//
// BenefitsSafe handles SSN last 4, DOB, legal names, addresses, email,
// phone, and bank account metadata for beneficiaries and cardholders. A
// single unhandled error that serializes a request body or includes a
// user object in Sentry `extra` ships all of that to a third-party
// observability vendor — which is a HIPAA/SOC2/GDPR problem and a
// potential CCPA violation for California-resident beneficiaries.
//
// Every Sentry.init() (server, client, edge) routes its `beforeSend`
// hook through scrubPii() before upload. Scrub logic:
//
//   1. Strip request body entirely — it can contain anything.
//   2. Strip Authorization, Cookie, and Stripe-Signature headers.
//   3. Redact known PII query string params.
//   4. Walk `extra` / `contexts` / `tags` recursively and redact any
//      key that matches our PII_KEYS allowlist (case-insensitive).
//   5. Regex-redact SSN + email patterns that slipped into exception
//      message strings (e.g. `throw new Error(\`User \${email} failed\`)`).

import type { ErrorEvent } from "@sentry/nextjs";

const PII_KEYS = new Set<string>([
  // SSN
  "ssn",
  "ssnlast4",
  "ssn_last4",
  // Auth / secrets
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "apikey",
  "api_key",
  "mfasecret",
  "mfa_secret",
  "totpsecret",
  "totp_secret",
  "encryptionkey",
  // Personal details
  "dateofbirth",
  "date_of_birth",
  "dob",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "middlename",
  "middle_name",
  "fullname",
  "full_name",
  "legalname",
  "legal_name",
  // Contact
  "email",
  "emailaddress",
  "email_address",
  "phone",
  "phonenumber",
  "phone_number",
  // Address
  "addressstreet",
  "address_street",
  "addressline1",
  "address_line1",
  "addressline2",
  "address_line2",
  "addresscity",
  "address_city",
  "addressstate",
  "address_state",
  "addresszip",
  "address_zip",
  "postalcode",
  "postal_code",
  "zipcode",
  "zip_code",
  // Financial
  "cardnumber",
  "card_number",
  "cvc",
  "cvv",
  "accountnumber",
  "account_number",
  "routingnumber",
  "routing_number",
  "stripecustomerid",
  "stripe_customer_id",
  // Medical / benefit program detail
  "medicaidid",
  "medicaid_id",
  "benefitid",
  "benefit_id",
]);

const REDACTED = "[REDACTED]";

// Regex patterns for inline redaction of exception message strings.
// Keep narrow — overly greedy patterns can obscure useful stack info.
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const CC_LIKE_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

function isPiiKey(key: string): boolean {
  return PII_KEYS.has(key.toLowerCase());
}

function scrubValue(value: unknown, depth = 0): unknown {
  // Guard against circular references and runaway object graphs.
  if (depth > 8) return REDACTED;
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isPiiKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function scrubString(s: string): string {
  return s
    .replace(SSN_PATTERN, "[SSN]")
    .replace(CC_LIKE_PATTERN, (m) =>
      // Only redact strings that look like card numbers after stripping
      // separators; avoid eating long phone numbers or zip+4.
      m.replace(/[^0-9]/g, "").length >= 13 ? "[CARD]" : m,
    )
    .replace(EMAIL_PATTERN, "[EMAIL]");
}

export function scrubPii(event: ErrorEvent): ErrorEvent {
  // 1. Strip the request body — it can carry anything.
  if (event.request) {
    if (event.request.data !== undefined) {
      event.request.data = "[REDACTED BODY]";
    }

    // 2. Strip auth / session headers.
    if (event.request.headers && typeof event.request.headers === "object") {
      const headers = event.request.headers as Record<string, string>;
      const safe: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        const lk = k.toLowerCase();
        if (
          lk === "authorization" ||
          lk === "cookie" ||
          lk === "set-cookie" ||
          lk === "x-stripe-signature" ||
          lk === "stripe-signature" ||
          lk === "x-postmark-server-token"
        ) {
          safe[k] = REDACTED;
        } else {
          safe[k] = v;
        }
      }
      event.request.headers = safe;
    }

    // 3. Redact sensitive query string params.
    if (
      typeof event.request.query_string === "string" &&
      event.request.query_string.length > 0
    ) {
      event.request.query_string = event.request.query_string.replace(
        /([?&])(token|email|ssn|password|apikey|api_key|secret)=[^&]*/gi,
        "$1$2=" + REDACTED,
      );
    }
  }

  // 4. Walk extra / contexts / tags recursively.
  if (event.extra) {
    event.extra = scrubValue(event.extra) as ErrorEvent["extra"];
  }
  if (event.contexts) {
    for (const [k, v] of Object.entries(event.contexts)) {
      if (v && typeof v === "object") {
        (event.contexts as Record<string, unknown>)[k] = scrubValue(v);
      }
    }
  }
  if (event.tags && typeof event.tags === "object") {
    const tags = event.tags as Record<string, unknown>;
    for (const [k, v] of Object.entries(tags)) {
      if (isPiiKey(k) && typeof v === "string") {
        tags[k] = REDACTED;
      }
    }
  }
  if (event.user) {
    // Keep Sentry's native user.id/ip_address/username fields (useful for
    // grouping) but strip everything else — especially email.
    const u = event.user as Record<string, unknown>;
    event.user = {
      id: typeof u.id === "string" ? u.id : undefined,
      ip_address: typeof u.ip_address === "string" ? u.ip_address : undefined,
    };
  }

  // 5. Regex-scrub exception message strings and breadcrumb messages.
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === "string") {
        ex.value = scrubString(ex.value);
      }
    }
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === "string") {
        crumb.message = scrubString(crumb.message);
      }
      if (crumb.data && typeof crumb.data === "object") {
        crumb.data = scrubValue(crumb.data) as typeof crumb.data;
      }
    }
  }
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }

  return event;
}
