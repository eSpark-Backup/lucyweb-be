/*
  Warnings:

  - You are about to drop the column `parent_trust_id` on the `Organization` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_parent_trust_id_fkey";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "parent_trust_id";

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" INTEGER NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
