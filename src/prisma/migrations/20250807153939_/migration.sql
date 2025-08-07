/*
  Warnings:

  - You are about to drop the column `school_city` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `school_country` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `school_name` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `school_region` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `school_type` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `school_user_position` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "school_city",
DROP COLUMN "school_country",
DROP COLUMN "school_name",
DROP COLUMN "school_region",
DROP COLUMN "school_type",
DROP COLUMN "school_user_position",
ALTER COLUMN "role_id" SET DEFAULT 4;
