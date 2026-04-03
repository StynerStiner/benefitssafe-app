import { Composio } from "@composio/core";

// Event types that can trigger workflows
export type WorkflowEventType =
  | "expense_approved"
  | "card_issued"
  | "transaction_needs_review"
  | "grant_low_balance"
  | "beneficiary_onboarded"
  | "card_transaction_completed"
  | "beneficiary_document_uploaded";

// Payload shapes for each event
export interface WorkflowEventPayload {
  expense_approved: {
    expenseId: string;
    beneficiaryName: string;
    beneficiaryEmail: string;
    amount: number;
    category: string;
    grantName: string;
    approvedBy: string;
  };
  card_issued: {
    cardId: string;
    beneficiaryName: string;
    beneficiaryEmail: string;
    last4: string;
    spendingLimit: number;
    grantName: string;
  };
  transaction_needs_review: {
    transactionId: string;
    beneficiaryName: string;
    amount: number;
    merchantName: string;
    mccCode: string;
    riskClassification: string;
    grantName: string;
  };
  grant_low_balance: {
    grantId: string;
    grantName: string;
    currentBalance: number;
    threshold: number;
    percentRemaining: number;
  };
  beneficiary_onboarded: {
    beneficiaryId: string;
    beneficiaryName: string;
    beneficiaryEmail: string;
    beneficiaryCode: string;
    caseManagerName: string;
    caseManagerEmail: string;
  };
  card_transaction_completed: {
    transactionId: string;
    beneficiaryName: string;
    amount: number;
    merchantName: string;
    grantName: string;
    remainingBalance: number;
  };
  beneficiary_document_uploaded: {
    documentId: string;
    beneficiaryName: string;
    documentType: string;
    uploadedAt: string;
  };
}

export class WorkflowEngine {
  private composio: Composio;

  constructor() {
    this.composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  }

  /**
   * Fire all active workflow triggers for a given event.
   * Call this from API routes and webhook handlers.
   * Runs async -- does not block the calling request.
   */
  async fire<T extends WorkflowEventType>(
    organizationId: string,
    eventType: T,
    payload: WorkflowEventPayload[T]
  ): Promise<void> {
    // Skip if Composio is not configured
    if (!process.env.COMPOSIO_API_KEY) return;

    // Check tier usage before executing
    const { canExecuteWorkflow } = await import("@/lib/composio-usage");
    if (!(await canExecuteWorkflow())) return;

    // Dynamic import to avoid circular deps
    const { prisma } = await import("@/lib/db");

    // Get all active triggers for this org + event type
    const triggers = await prisma.workflowTrigger.findMany({
      where: {
        organizationId,
        eventType,
        enabled: true,
      },
    });

    if (triggers.length === 0) return;

    // Get org's connected integrations
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId,
        status: "connected",
      },
    });

    const connectedProviders = new Map(
      integrations.map((i: { provider: string; composioConnectionId: string | null }) => [
        i.provider,
        i.composioConnectionId,
      ])
    );

    // Execute each trigger in parallel (non-blocking, log results)
    const executions = triggers.map(async (trigger: {
      id: string;
      provider: string;
      actionSlug: string;
      actionConfig: unknown;
    }) => {
      const startTime = Date.now();
      const connectionId = connectedProviders.get(trigger.provider);

      if (!connectionId) {
        await prisma.workflowLog.create({
          data: {
            organizationId,
            triggerId: trigger.id,
            eventType,
            provider: trigger.provider,
            actionSlug: trigger.actionSlug,
            status: "skipped",
            errorMessage: `Provider ${trigger.provider} not connected`,
          },
        });
        return;
      }

      try {
        // Build action parameters from template + payload
        const actionParams = this.buildActionParams(
          trigger.actionConfig as Record<string, unknown>,
          payload as Record<string, unknown>
        );

        // Execute via Composio (direct tool execution for server-side workflows)
        const session = await this.composio.create(organizationId);
        const result = await session.execute(trigger.actionSlug, actionParams);

        await prisma.workflowLog.create({
          data: {
            organizationId,
            triggerId: trigger.id,
            eventType,
            provider: trigger.provider,
            actionSlug: trigger.actionSlug,
            status: "success",
            requestPayload: actionParams as object,
            responsePayload: (result ?? {}) as object,
            executionTimeMs: Date.now() - startTime,
          },
        });
      } catch (error) {
        await prisma.workflowLog.create({
          data: {
            organizationId,
            triggerId: trigger.id,
            eventType,
            provider: trigger.provider,
            actionSlug: trigger.actionSlug,
            status: "failed",
            requestPayload: null,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            executionTimeMs: Date.now() - startTime,
          },
        });
      }
    });

    // Fire all in parallel, don't await in the calling context
    Promise.allSettled(executions).catch(console.error);
  }

  /**
   * Interpolate template variables with event payload data.
   * Templates use {{variableName}} syntax.
   */
  private buildActionParams(
    config: Record<string, unknown>,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string") {
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
          return String(payload[varName] ?? `{{${varName}}}`);
        });
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// Singleton with lazy initialization
let workflowEngine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine();
  }
  return workflowEngine;
}
