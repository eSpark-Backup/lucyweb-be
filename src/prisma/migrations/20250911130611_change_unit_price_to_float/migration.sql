-- AlterTable
ALTER TABLE "public"."Payment" ALTER COLUMN "unit_price" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Payment_organization_id_status_idx" ON "public"."Payment"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Payment_stripe_session_id_idx" ON "public"."Payment"("stripe_session_id");

-- CreateIndex
CREATE INDEX "Payment_stripe_invoice_id_idx" ON "public"."Payment"("stripe_invoice_id");
