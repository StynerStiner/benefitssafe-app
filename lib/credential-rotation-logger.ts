// BSRS Ch 8 P4 — structured-log emitter for credential rotations.
//
// Every rotation is a pair of events:
//   1. startRotation() → emits phase: "started", returns { rotation_id,
//      started_at } so the caller can pass them to the terminator.
//   2. completeRotation() OR failRotation() → emits phase: "completed"
//      or "failed" with latency_ms.
//
// Events land in Better Stack via lib/logger.ts and in the append-only
// ledger at docs/runbooks/credential-rotation-history.md (appended
// manually after a rotation; the linter cross-checks both).
//
// Defense in depth: sanitize() runs before every emission and rejects
// (or strips) payloads shaped like credentials, in case an operator
// typos and passes a secret as a property. The logger must NEVER emit
// a credential value.

import { randomUUID } from "node:crypto";
import { logger } from "./logger";

// ────────────────────────────────────────────────────────────────────
// Types — the canonical credential inventory
// ────────────────────────────────────────────────────────────────────

export type CredentialKind =
  | "aurora_master"
  | "aurora_app_role"
  | "stripe_live_secret"
  | "stripe_test_secret"
  | "stripe_webhook_primary"
  | "stripe_webhook_billing"
  | "stripe_webhook_charges"
  | "aws_iam_deployer"
  | "auth_secret"
  | "encryption_key"
  | "cron_secret"
  | "internal_api_key"
  | "anthropic_api_key"
  | "composio_api_key"
  | "postmark_api_token"
  | "sentry_auth_token"
  | "upstash_redis_token"
  | "qstash_token"
  | "qstash_signing_current"
  | "qstash_signing_next";

export type RotationIncident = "routine" | "emergency" | "post_breach";

export interface CredentialRotationStarted {
  event: "credential_rotation";
  phase: "started";
  rotation_id: string;
  credential_kind: CredentialKind;
  started_at: string;
  operator: string;
  incident: RotationIncident;
}

export interface CredentialRotationCompleted {
  event: "credential_rotation";
  phase: "completed";
  rotation_id: string;
  credential_kind: CredentialKind;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  operator: string;
  incident: RotationIncident;
}

export interface CredentialRotationFailed {
  event: "credential_rotation";
  phase: "failed";
  rotation_id: string;
  credential_kind: CredentialKind;
  started_at: string;
  failed_at: string;
  latency_ms: number;
  operator: string;
  incident: RotationIncident;
  error_summary: string;
}

// ────────────────────────────────────────────────────────────────────
// Sanitize — defense in depth against operator typos
// ────────────────────────────────────────────────────────────────────

const RULE_1_NAME_RE = /^(secret|key|password|token)$/i;
const RULE_2_VALUE_RE =
  /^(sk_live_|sk_test_|pk_live_|pk_test_|whsec_|rk_live_|AKIA|ASIA|rds!|Bearer\s|eyJ[A-Za-z0-9_-]{10,})/;
const RULE_3_BASE64_RE = /^[A-Za-z0-9+/=_-]{40,}$/;

// Known safe high-entropy fields that always pass Rule 3 — rotation_id
// is a UUID (36 chars, under 40), but started_at/completed_at/failed_at
// (20 chars ISO) are also under the threshold so no explicit allowlist
// is needed. If we ever add a field that legitimately crosses 40 chars,
// add it to this allowlist.
const RULE_3_ALLOWLIST: readonly string[] = [];

export class CredentialInLogError extends Error {
  readonly rule: "rule_1_property_name" | "rule_2_credential_prefix";
  constructor(
    rule: "rule_1_property_name" | "rule_2_credential_prefix",
    detail: string,
  ) {
    super(`Refusing to emit credential_rotation event: ${detail}`);
    this.name = "CredentialInLogError";
    this.rule = rule;
  }
}

function sanitize<T extends Record<string, unknown>>(payload: T): T {
  const clone: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(clone)) {
    if (RULE_1_NAME_RE.test(key)) {
      throw new CredentialInLogError(
        "rule_1_property_name",
        `property "${key}" matches credential-shape name`,
      );
    }
    if (typeof value === "string") {
      if (RULE_2_VALUE_RE.test(value)) {
        throw new CredentialInLogError(
          "rule_2_credential_prefix",
          `value of "${key}" starts with a known credential prefix`,
        );
      }
      if (
        RULE_3_BASE64_RE.test(value) &&
        !RULE_3_ALLOWLIST.includes(key)
      ) {
        logger.warn("credential_rotation_logger: suspicious payload shape", {
          property: key,
          rule: "rule_3_base64_40_plus",
        });
        delete clone[key];
      }
    }
  }
  return clone as T;
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export interface StartRotationArgs {
  credential_kind: CredentialKind;
  operator: string;
  incident: RotationIncident;
}

export function startRotation(args: StartRotationArgs): {
  rotation_id: string;
  started_at: string;
} {
  const rotation_id = randomUUID();
  const started_at = new Date().toISOString();
  // Spread args first so any extra properties (operator typos) land in the
  // merged object and get caught by sanitize. Known fields overwrite.
  const merged: Record<string, unknown> = {
    ...(args as unknown as Record<string, unknown>),
    event: "credential_rotation",
    phase: "started",
    rotation_id,
    started_at,
  };
  logger.info("credential_rotation", sanitize(merged));
  return { rotation_id, started_at };
}

export interface CompleteRotationArgs {
  rotation_id: string;
  started_at: string;
  credential_kind: CredentialKind;
  operator: string;
  incident: RotationIncident;
}

export function completeRotation(args: CompleteRotationArgs): void {
  const completed_at = new Date().toISOString();
  const latency_ms =
    new Date(completed_at).getTime() - new Date(args.started_at).getTime();
  const merged: Record<string, unknown> = {
    ...(args as unknown as Record<string, unknown>),
    event: "credential_rotation",
    phase: "completed",
    completed_at,
    latency_ms,
  };
  logger.info("credential_rotation", sanitize(merged));
}

export interface FailRotationArgs extends CompleteRotationArgs {
  error_summary: string;
}

export function failRotation(args: FailRotationArgs): void {
  const failed_at = new Date().toISOString();
  const latency_ms =
    new Date(failed_at).getTime() - new Date(args.started_at).getTime();
  const merged: Record<string, unknown> = {
    ...(args as unknown as Record<string, unknown>),
    event: "credential_rotation",
    phase: "failed",
    failed_at,
    latency_ms,
  };
  logger.error("credential_rotation", sanitize(merged));
}
