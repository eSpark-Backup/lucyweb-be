/*
  Warnings:

  - You are about to drop the column `role_id` on the `Profile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_role_id_fkey";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "role_id";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role_id" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
