import { AsyncLocalStorage } from "node:async_hooks";

export type OrgContext =
  | { kind: "session"; organizationId: string; userId: string; role: string }
  | { kind: "exempt"; reason: ExemptReason; note?: string };

export type ExemptReason =
  | "CRON"
  | "WEBHOOK_DERIVE"
  | "AUTH_FLOW"
  | "PLATFORM_ADMIN"
  | "PLATFORM_METRIC"
  | "STATS_ADMIN";

export const orgContextStore = new AsyncLocalStorage<OrgContext>();

export function withOrgContext<T>(ctx: OrgContext, fn: () => Promise<T>): Promise<T> {
  return orgContextStore.run(ctx, fn);
}

export function getOrgContext(): OrgContext | undefined {
  return orgContextStore.getStore();
}
