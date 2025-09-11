/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `School` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "school_id" INTEGER;

-- AlterTable
ALTER TABLE "public"."School" ADD COLUMN     "password" TEXT,
ADD COLUMN     "user_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "School_user_id_key" ON "public"."School"("user_id");

-- AddForeignKey
ALTER TABLE "public"."School" ADD CONSTRAINT "School_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
