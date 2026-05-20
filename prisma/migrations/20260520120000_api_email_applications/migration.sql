-- CreateEnum
CREATE TYPE "ApiEmailTaskStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "senderEmail" TEXT NOT NULL,
    "encryptedPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_email_tasks" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "status" "ApiEmailTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "externalReferenceId" TEXT,
    "senderEmail" TEXT NOT NULL,
    "queueJobId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "smtpResponse" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_email_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_isActive_idx" ON "applications"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "api_tokens_applicationId_idx" ON "api_tokens"("applicationId");

-- CreateIndex
CREATE INDEX "api_tokens_tokenPrefix_idx" ON "api_tokens"("tokenPrefix");

-- CreateIndex
CREATE INDEX "api_email_tasks_applicationId_status_idx" ON "api_email_tasks"("applicationId", "status");

-- CreateIndex
CREATE INDEX "api_email_tasks_externalReferenceId_idx" ON "api_email_tasks"("externalReferenceId");

-- CreateIndex
CREATE INDEX "api_email_tasks_createdAt_idx" ON "api_email_tasks"("createdAt");

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_email_tasks" ADD CONSTRAINT "api_email_tasks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
