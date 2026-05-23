-- AlterEnum
ALTER TYPE "ApiEmailTaskStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';

-- AlterTable
ALTER TABLE "api_email_tasks" ADD COLUMN "bouncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "api_email_events" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "status" "ApiEmailTaskStatus" NOT NULL,
    "externalReferenceId" TEXT,
    "message" TEXT,
    "smtpResponse" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_email_events_applicationId_createdAt_idx" ON "api_email_events"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "api_email_events_taskId_idx" ON "api_email_events"("taskId");

-- CreateIndex
CREATE INDEX "api_email_events_recipientEmail_idx" ON "api_email_events"("recipientEmail");

-- CreateIndex
CREATE INDEX "api_email_events_status_idx" ON "api_email_events"("status");

-- CreateIndex
CREATE INDEX "api_email_events_createdAt_idx" ON "api_email_events"("createdAt");

-- AddForeignKey
ALTER TABLE "api_email_events" ADD CONSTRAINT "api_email_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_email_events" ADD CONSTRAINT "api_email_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "api_email_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill
INSERT INTO "api_email_events" (
    "id",
    "applicationId",
    "taskId",
    "recipientEmail",
    "senderEmail",
    "status",
    "externalReferenceId",
    "message",
    "smtpResponse",
    "attempts",
    "createdAt"
)
SELECT
    'evt_' || md5("id" || "status"::text || "createdAt"::text),
    "applicationId",
    "id",
    "toEmail",
    "senderEmail",
    "status",
    "externalReferenceId",
    COALESCE("lastError", CASE
        WHEN "status"::text = 'SENT' THEN 'E-mail entregue ao servidor SMTP.'
        WHEN "status"::text = 'QUEUED' THEN 'E-mail recebido pela API e colocado na fila.'
        WHEN "status"::text = 'SENDING' THEN 'Worker iniciou o envio via API.'
        WHEN "status"::text = 'FAILED' THEN 'Falha no envio via API.'
        ELSE NULL
    END),
    "smtpResponse",
    "attempts",
    "createdAt"
FROM "api_email_tasks";
