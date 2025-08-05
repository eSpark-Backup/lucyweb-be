/*
  Warnings:

  - You are about to drop the `Trust` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_trust_id_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role_id" INTEGER;

-- DropTable
DROP TABLE "Trust";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
