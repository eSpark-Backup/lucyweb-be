/*
  Warnings:

  - You are about to drop the `Trust` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role_id" INTEGER;

-- DropTable
