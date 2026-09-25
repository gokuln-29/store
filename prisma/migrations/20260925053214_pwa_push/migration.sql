-- CreateEnum
CREATE TYPE "PushCampaignStatus" AS ENUM ('SENDING', 'SENT');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "clientUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "offers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PushCampaign" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "imageUrl" TEXT,
    "url" TEXT,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'SENDING',
    "audienceCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushCampaign_status_createdAt_idx" ON "PushCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PushSubscription_offers_id_idx" ON "PushSubscription"("offers", "id");

-- AddForeignKey
ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

