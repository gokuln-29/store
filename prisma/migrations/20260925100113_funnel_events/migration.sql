-- CreateEnum
CREATE TYPE "FunnelStep" AS ENUM ('VISIT', 'ADD_TO_CART', 'CHECKOUT');

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "day" DATE NOT NULL,
    "sessionId" UUID NOT NULL,
    "step" "FunnelStep" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("day","sessionId","step")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_day_step_idx" ON "FunnelEvent"("day", "step");

