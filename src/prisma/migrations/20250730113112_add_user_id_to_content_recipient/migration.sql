/*
  Warnings:

  - Added the required column `user_id` to the `ContentRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContentRecipient" ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ContentRecipient" ADD CONSTRAINT "ContentRecipient_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
