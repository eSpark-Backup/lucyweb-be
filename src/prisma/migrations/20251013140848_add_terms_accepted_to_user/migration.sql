/*
  Warnings:

  - Changed the type of `content_type` on the `Content` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `text_content` on the `Content` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Content" DROP COLUMN "content_type",
ADD COLUMN     "content_type" JSONB NOT NULL,
DROP COLUMN "text_content",
ADD COLUMN     "text_content" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "termsAccepted" BOOLEAN NOT NULL DEFAULT false;
