/*
  Warnings:

  - A unique constraint covering the columns `[stripe_session_id]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "schools_count" INTEGER,
ADD COLUMN     "stripe_session_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "unit_price" INTEGER,
ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- AlterTable
ALTER TABLE "public"."School" ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripe_session_id_key" ON "public"."Payment"("stripe_session_id");
