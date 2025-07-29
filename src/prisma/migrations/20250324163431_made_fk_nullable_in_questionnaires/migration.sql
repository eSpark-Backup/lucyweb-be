-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_question_id_fkey";

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_response_id_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_questionnaire_id_fkey";

-- DropForeignKey
ALTER TABLE "QuestionnaireResponse" DROP CONSTRAINT "QuestionnaireResponse_questionnaire_id_fkey";

-- AlterTable
ALTER TABLE "Answer" ALTER COLUMN "question_id" DROP NOT NULL,
ALTER COLUMN "response_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "questionnaire_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuestionnaireResponse" ALTER COLUMN "questionnaire_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "Questionnaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "Questionnaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "QuestionnaireResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
