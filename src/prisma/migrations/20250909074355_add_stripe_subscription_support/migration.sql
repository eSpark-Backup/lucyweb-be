/*
  Warnings:

  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_invoice_id]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_price_id]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "stripe_subscription_id" TEXT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "stripe_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "public"."Subscription" ADD COLUMN     "stripe_price_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripe_subscription_id_key" ON "public"."Organization"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripe_invoice_id_key" ON "public"."Payment"("stripe_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_price_id_key" ON "public"."Subscription"("stripe_price_id");
