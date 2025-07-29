/*
  Warnings:

  - A unique constraint covering the columns `[response_id,question_id]` on the table `Answer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Answer_response_id_question_id_key" ON "Answer"("response_id", "question_id");
