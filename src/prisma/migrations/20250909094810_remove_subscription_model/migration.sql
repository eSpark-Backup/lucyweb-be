/*
  Warnings:

  - You are about to drop the column `subscription_id` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Organization" DROP CONSTRAINT "Organization_subscription_id_fkey";

-- AlterTable
ALTER TABLE "public"."Organization" DROP COLUMN "subscription_id";

-- DropTable
DROP TABLE "public"."Subscription";
