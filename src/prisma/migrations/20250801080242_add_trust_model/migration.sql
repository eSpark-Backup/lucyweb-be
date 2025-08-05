-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trust_id" INTEGER;

-- CreateTable
CREATE TABLE "Trust" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trust_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trust_email_key" ON "Trust"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE SET NULL ON UPDATE CASCADE;
