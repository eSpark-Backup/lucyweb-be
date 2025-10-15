/*
  Warnings:

  - You are about to drop the `Terms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Terms";

-- CreateTable
CREATE TABLE "public"."TermsAndConditions" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsAndConditions_pkey" PRIMARY KEY ("id")
);
