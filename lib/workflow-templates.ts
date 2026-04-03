import type { WorkflowEventType } from "./workflow-engine";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  eventType: WorkflowEventType;
  provider: string;
  actionSlug: string;
  actionConfig: Record<string, unknown>;
  category: "notifications" | "compliance" | "reporting" | "scheduling";
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // -- GMAIL TEMPLATES ---------------------------------------------------
  {
    id: "expense-approved-email",
    name: "Email beneficiary on expense approval",
    description:
      "Sends an email to the beneficiary when their expense request is approved.",
    eventType: "expense_approved",
    provider: "gmail",
    actionSlug: "GMAIL_SEND_EMAIL",
    actionConfig: {
      to: "{{beneficiaryEmail}}",
      subject:
        "Your expense request for {{category}} has been approved -- BenefitsSafe",
      body: "Hi {{beneficiaryName}},\n\nGreat news! Your expense request for {{category}} (${{amount}}) under the {{grantName}} grant has been approved by {{approvedBy}}.\n\nYour virtual card will be issued shortly. You'll receive card details in your BenefitsSafe dashboard.\n\nQuestions? Reply to this email or contact your case manager.\n\nBest,\nYour {{grantName}} Team",
    },
    category: "notifications",
  },
  {
    id: "card-issued-email",
    name: "Email beneficiary when card is issued",
    description:
      "Sends card issuance notification with instructions to view in dashboard.",
    eventType: "card_issued",
    provider: "gmail",
    actionSlug: "GMAIL_SEND_EMAIL",
    actionConfig: {
      to: "{{beneficiaryEmail}}",
      subject: "Your virtual card is ready -- BenefitsSafe",
      body: "Hi {{beneficiaryName}},\n\nYour virtual card ending in {{last4}} is ready to use. Your spending limit is ${{spendingLimit}}.\n\nTo view your card details, log into your BenefitsSafe dashboard.\n\nRemember: This card can only be used at approved vendors for eligible expenses under the {{grantName}} grant.\n\nBest,\nYour {{grantName}} Team",
    },
    category: "notifications",
  },
  {
    id: "needs-review-email",
    name: "Email compliance officer on flagged transaction",
    description:
      "Alerts the compliance team when a transaction is flagged for review.",
    eventType: "transaction_needs_review",
    provider: "gmail",
    actionSlug: "GMAIL_SEND_EMAIL",
    actionConfig: {
      to: "{{complianceOfficerEmail}}",
      subject:
        "[ACTION REQUIRED] Transaction flagged for review -- {{beneficiaryName}}",
      body: "A transaction requires compliance review:\n\nBeneficiary: {{beneficiaryName}}\nAmount: ${{amount}}\nMerchant: {{merchantName}}\nMCC Code: {{mccCode}}\nRisk Classification: {{riskClassification}}\nGrant: {{grantName}}\n\nPlease review this transaction in your BenefitsSafe dashboard.\n\nTransaction ID: {{transactionId}}",
    },
    category: "compliance",
  },
  {
    id: "low-balance-email",
    name: "Email finance director on low grant balance",
    description:
      "Alerts finance when a grant balance drops below the configured threshold.",
    eventType: "grant_low_balance",
    provider: "gmail",
    actionSlug: "GMAIL_SEND_EMAIL",
    actionConfig: {
      to: "{{financeDirectorEmail}}",
      subject:
        "[Low Balance Alert] {{grantName}} at {{percentRemaining}}% -- BenefitsSafe",
      body: "The following grant is running low on funds:\n\nGrant: {{grantName}}\nCurrent Balance: ${{currentBalance}}\nThreshold: ${{threshold}}\nRemaining: {{percentRemaining}}%\n\nPlease initiate a funding transfer in your BenefitsSafe dashboard or contact the grantor.",
    },
    category: "compliance",
  },
  {
    id: "beneficiary-welcome-email",
    name: "Send welcome email to new beneficiary",
    description:
      "Sends onboarding instructions when a new beneficiary is added.",
    eventType: "beneficiary_onboarded",
    provider: "gmail",
    actionSlug: "GMAIL_SEND_EMAIL",
    actionConfig: {
      to: "{{beneficiaryEmail}}",
      subject: "Welcome to BenefitsSafe -- Getting Started",
      body: "Hi {{beneficiaryName}},\n\nWelcome to BenefitsSafe! Your account has been created.\n\nYour Beneficiary Code: {{beneficiaryCode}}\nYour Case Manager: {{caseManagerName}}\n\nHere's what happens next:\n1. Your case manager will submit expense requests on your behalf\n2. Once approved, you'll receive a virtual debit card\n3. Use the card at approved vendors only\n4. Keep all receipts -- your case manager may ask for them\n\nLog into your dashboard at https://benefitssafe.com to get started.\n\nQuestions? Contact {{caseManagerName}} at {{caseManagerEmail}}.\n\nBest,\nThe BenefitsSafe Team",
    },
    category: "notifications",
  },

  // -- SLACK TEMPLATES ---------------------------------------------------
  {
    id: "expense-approved-slack",
    name: "Post to Slack on expense approval",
    description: "Posts a notification to your team Slack channel.",
    eventType: "expense_approved",
    provider: "slack",
    actionSlug: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
    actionConfig: {
      channel: "{{slackChannel}}",
      text: "Expense approved: {{beneficiaryName}} -- ${{amount}} for {{category}} ({{grantName}}). Approved by {{approvedBy}}.",
    },
    category: "notifications",
  },
  {
    id: "needs-review-slack",
    name: "Post to Slack on flagged transaction",
    description:
      "Alerts your compliance channel when a transaction needs review.",
    eventType: "transaction_needs_review",
    provider: "slack",
    actionSlug: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
    actionConfig: {
      channel: "{{slackComplianceChannel}}",
      text: "REVIEW NEEDED: {{beneficiaryName}} -- ${{amount}} at {{merchantName}} (MCC: {{mccCode}}). Risk: {{riskClassification}}. Grant: {{grantName}}.",
    },
    category: "compliance",
  },

  // -- GOOGLE CALENDAR TEMPLATES -----------------------------------------
  {
    id: "expense-reconciliation-calendar",
    name: "Create 30-day reconciliation reminder",
    description:
      "Adds a calendar event 30 days after expense approval for reconciliation.",
    eventType: "expense_approved",
    provider: "google_calendar",
    actionSlug: "GOOGLECALENDAR_CREATE_EVENT",
    actionConfig: {
      title:
        "Reconciliation Due: {{beneficiaryName}} -- {{category}} (${{amount}})",
      description:
        "30-day reconciliation deadline for expense under {{grantName}}. Review receipts and verify vendor compliance.",
      duration: 30,
      offsetDays: 30,
    },
    category: "compliance",
  },
  {
    id: "beneficiary-checkin-calendar",
    name: "Schedule beneficiary check-in",
    description:
      "Creates a check-in calendar event 7 days after onboarding.",
    eventType: "beneficiary_onboarded",
    provider: "google_calendar",
    actionSlug: "GOOGLECALENDAR_CREATE_EVENT",
    actionConfig: {
      title: "Check-in: {{beneficiaryName}} ({{beneficiaryCode}})",
      description:
        "7-day onboarding check-in with {{beneficiaryName}}. Case manager: {{caseManagerName}}.",
      duration: 30,
      offsetDays: 7,
    },
    category: "scheduling",
  },

  // -- GOOGLE SHEETS TEMPLATES -------------------------------------------
  {
    id: "transaction-review-sheet",
    name: "Log flagged transactions to Google Sheet",
    description:
      "Appends a row to your audit spreadsheet when a transaction is flagged.",
    eventType: "transaction_needs_review",
    provider: "google_sheets",
    actionSlug: "GOOGLESHEETS_BATCH_UPDATE",
    actionConfig: {
      spreadsheetId: "{{auditSpreadsheetId}}",
      sheetName: "Flagged Transactions",
      values: [
        "{{transactionId}}",
        "{{beneficiaryName}}",
        "{{amount}}",
        "{{merchantName}}",
        "{{mccCode}}",
        "{{riskClassification}}",
        "{{grantName}}",
      ],
    },
    category: "reporting",
  },
];

// Helper: get templates by provider
export function getTemplatesByProvider(provider: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((t) => t.provider === provider);
}

// Helper: get templates by category
export function getTemplatesByCategory(
  category: WorkflowTemplate["category"]
): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((t) => t.category === category);
}

// Helper: get template by ID
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

// Supported providers with display metadata
export const SUPPORTED_PROVIDERS = [
  { id: "gmail", name: "Gmail", icon: "Mail" },
  { id: "slack", name: "Slack", icon: "MessageSquare" },
  { id: "google_calendar", name: "Google Calendar", icon: "Calendar" },
  { id: "google_sheets", name: "Google Sheets", icon: "Sheet" },
  { id: "asana", name: "Asana", icon: "CheckSquare" },
  { id: "trello", name: "Trello", icon: "Trello" },
] as const;
