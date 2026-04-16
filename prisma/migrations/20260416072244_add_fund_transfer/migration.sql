-- CreateTable
CREATE TABLE "FundTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "bankPaymentMethodId" TEXT NOT NULL,
    "stripeTransferId" TEXT,
    "stripeAccountId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundTransfer_organizationId_requestId_key" ON "FundTransfer"("organizationId", "requestId");

-- CreateIndex
CREATE INDEX "FundTransfer_organizationId_createdAt_idx" ON "FundTransfer"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FundTransfer_status_idx" ON "FundTransfer"("status");

-- AddForeignKey
ALTER TABLE "FundTransfer" ADD CONSTRAINT "FundTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransfer" ADD CONSTRAINT "FundTransfer_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
