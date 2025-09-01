-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "is_trust" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_trust_id" INTEGER,
ADD COLUMN     "selected_school_count" INTEGER;

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parent_trust_id_fkey" FOREIGN KEY ("parent_trust_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
