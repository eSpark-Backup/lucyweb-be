/*
  Warnings:

  - You are about to drop the column `questionnaire_id` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the `Questionnaire` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionnaireResponse` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `question_id` on table `Answer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `response_id` on table `Answer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `created_by` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_question_id_fkey";

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_response_id_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_questionnaire_id_fkey";

-- DropForeignKey
ALTER TABLE "Questionnaire" DROP CONSTRAINT "Questionnaire_created_by_fkey";

-- DropForeignKey
ALTER TABLE "QuestionnaireResponse" DROP CONSTRAINT "QuestionnaireResponse_questionnaire_id_fkey";

-- AlterTable
ALTER TABLE "Answer" ALTER COLUMN "question_id" SET NOT NULL,
ALTER COLUMN "response_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "questionnaire_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "Questionnaire";

-- DropTable
DROP TABLE "QuestionnaireResponse";

-- CreateTable
CREATE TABLE "Response" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
