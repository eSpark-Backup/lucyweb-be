/*
  Warnings:

  - You are about to drop the column `date_time` on the `Event` table. All the data in the column will be lost.
  - Added the required column `end_date` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "start_date" TIMESTAMP(3);

-- Update existing rows to set start_date and end_date to date_time
UPDATE "public"."Event" SET "start_date" = "date_time", "end_date" = "date_time";

-- Make columns NOT NULL
ALTER TABLE "public"."Event" ALTER COLUMN "start_date" SET NOT NULL,
ALTER COLUMN "end_date" SET NOT NULL;

-- Drop old column
ALTER TABLE "public"."Event" DROP COLUMN "date_time";
