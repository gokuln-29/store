-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cartReminders" BOOLEAN NOT NULL DEFAULT true;

