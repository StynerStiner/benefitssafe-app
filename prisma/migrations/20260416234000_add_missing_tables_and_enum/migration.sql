-- Migration: add_missing_tables_and_enum
-- Generated: 2026-04-16
-- Scope: Create 15 missing tables + EligibilityStatus enum
--        identified by the Path B three-table diagnostic.
--
-- IN SCOPE (new tables):
--   Conversation, ConversationParticipant, Message, Notification,
--   PromoCode, PromoRedemption, CalendarEvent, CronCheckpoint,
--   Integration, WorkflowTrigger, WorkflowLog, GrantReport,
--   UsageCounter, ProcessedWebhookEvent, CardholderEligibility
-- IN SCOPE (enum):
--   EligibilityStatus (required by CardholderEligibility)
--
-- OUT OF SCOPE (Migration 2 of 2):
--   33 missing columns on 13 existing tables
--   6 organizationId NOT NULL hazard backfills (all tables empty)
--   ~10 missing indexes on existing tables
--
-- Safety: Pure new DDL. Zero modification of existing tables.
--         All tables created empty. No data migration.
--         onDelete behaviors match schema.prisma exactly:
--         - Integration / WorkflowTrigger / WorkflowLog: CASCADE
--         - All other FKs: default RESTRICT (required FK).

-- ============================================================
-- Enum (1)
-- ============================================================

CREATE TYPE "EligibilityStatus" AS ENUM (
    'ELIGIBLE',
    'RESTRICTED_CALFRESH_ONLY',
    'INELIGIBLE_WARRANT',
    'INELIGIBLE_INCARCERATED',
    'PENDING_VERIFICATION'
);

-- ============================================================
-- Tables (15)
-- ============================================================

-- Conversation
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- ConversationParticipant
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- Message
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- PromoCode
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "trialDays" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 50,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- PromoRedemption
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "redeemedById" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CalendarEvent
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "category" TEXT NOT NULL DEFAULT 'general',
    "color" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CronCheckpoint
CREATE TABLE "CronCheckpoint" (
    "id" TEXT NOT NULL,
    "cronName" TEXT NOT NULL,
    "lastCursor" TEXT,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronCheckpoint_pkey" PRIMARY KEY ("id")
);

-- Integration
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "composioConnectionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "connectedBy" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- WorkflowTrigger
CREATE TABLE "WorkflowTrigger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "actionSlug" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);

-- WorkflowLog
CREATE TABLE "WorkflowLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "actionSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowLog_pkey" PRIMARY KEY ("id")
);

-- GrantReport
CREATE TABLE "GrantReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'weekly_disbursement',
    "reportData" JSONB NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL DEFAULT 'sentinellayer_reporter',
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "GrantReport_pkey" PRIMARY KEY ("id")
);

-- UsageCounter
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "beneficiariesAdded" INTEGER NOT NULL DEFAULT 0,
    "grantsCreated" INTEGER NOT NULL DEFAULT 0,
    "expensesProcessed" INTEGER NOT NULL DEFAULT 0,
    "cardsIssued" INTEGER NOT NULL DEFAULT 0,
    "apiCalls" INTEGER NOT NULL DEFAULT 0,
    "storageMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- ProcessedWebhookEvent (id = Stripe event.id, no cuid default)
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CardholderEligibility
CREATE TABLE "CardholderEligibility" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hasActiveWarrant" BOOLEAN NOT NULL DEFAULT false,
    "isCurrentlyIncarcerated" BOOLEAN NOT NULL DEFAULT false,
    "hasDrugTraffickingConviction" BOOLEAN NOT NULL DEFAULT false,
    "probationParoleRestrictions" TEXT,
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "ofacScreened" BOOLEAN NOT NULL DEFAULT false,
    "ofacMatchFound" BOOLEAN NOT NULL DEFAULT false,
    "ofacScreenedAt" TIMESTAMP(3),
    "ofacMatches" JSONB,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardholderEligibility_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- Unique indexes (7)
-- ============================================================

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE UNIQUE INDEX "CronCheckpoint_cronName_key" ON "CronCheckpoint"("cronName");
CREATE UNIQUE INDEX "CardholderEligibility_beneficiaryId_key" ON "CardholderEligibility"("beneficiaryId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_organizationId_key" ON "PromoRedemption"("promoCodeId", "organizationId");
CREATE UNIQUE INDEX "Integration_organizationId_provider_key" ON "Integration"("organizationId", "provider");
CREATE UNIQUE INDEX "UsageCounter_organizationId_period_key" ON "UsageCounter"("organizationId", "period");

-- ============================================================
-- Non-unique indexes (20)
-- ============================================================

CREATE INDEX "Conversation_organizationId_idx" ON "Conversation"("organizationId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");
CREATE INDEX "Notification_userId_organizationId_createdAt_idx" ON "Notification"("userId", "organizationId", "createdAt");
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");
CREATE INDEX "PromoRedemption_organizationId_idx" ON "PromoRedemption"("organizationId");
CREATE INDEX "CalendarEvent_organizationId_idx" ON "CalendarEvent"("organizationId");
CREATE INDEX "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");
CREATE INDEX "CalendarEvent_organizationId_startDate_idx" ON "CalendarEvent"("organizationId", "startDate");
CREATE INDEX "WorkflowTrigger_organizationId_eventType_idx" ON "WorkflowTrigger"("organizationId", "eventType");
CREATE INDEX "WorkflowTrigger_organizationId_enabled_idx" ON "WorkflowTrigger"("organizationId", "enabled");
CREATE INDEX "WorkflowLog_organizationId_createdAt_idx" ON "WorkflowLog"("organizationId", "createdAt");
CREATE INDEX "WorkflowLog_triggerId_idx" ON "WorkflowLog"("triggerId");
CREATE INDEX "GrantReport_organizationId_grantId_idx" ON "GrantReport"("organizationId", "grantId");
CREATE INDEX "GrantReport_organizationId_generatedAt_idx" ON "GrantReport"("organizationId", "generatedAt");
CREATE INDEX "ProcessedWebhookEvent_webhookType_processedAt_idx" ON "ProcessedWebhookEvent"("webhookType", "processedAt");
CREATE INDEX "CardholderEligibility_organizationId_idx" ON "CardholderEligibility"("organizationId");

-- ============================================================
-- Foreign keys (11)
--   onDelete: Cascade → Integration, WorkflowTrigger, WorkflowLog
--   onDelete: RESTRICT (Prisma default for required FK) → everything else
-- ============================================================

ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTrigger" ADD CONSTRAINT "WorkflowTrigger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowLog" ADD CONSTRAINT "WorkflowLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardholderEligibility" ADD CONSTRAINT "CardholderEligibility_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardholderEligibility" ADD CONSTRAINT "CardholderEligibility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
