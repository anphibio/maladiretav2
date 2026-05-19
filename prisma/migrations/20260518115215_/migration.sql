-- CreateTable
CREATE TABLE "campaign_attachments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_attachments_campaignId_idx" ON "campaign_attachments"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_attachments" ADD CONSTRAINT "campaign_attachments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
