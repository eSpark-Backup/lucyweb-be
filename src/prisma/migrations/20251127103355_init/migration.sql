-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email_verification_expires" TIMESTAMP(3),
    "email_verification_token" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "role_id" INTEGER,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TermsAndConditions" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsAndConditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "subscription_end" TIMESTAMP(3),
    "is_special" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "date_time" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "user_id" INTEGER NOT NULL,
    "school_id" INTEGER,
    "image" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "organization_id" INTEGER,
    "profile_image" TEXT,
    "role_id" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "is_trust" BOOLEAN NOT NULL DEFAULT false,
    "selected_school_count" INTEGER,
    "paid_school_count" INTEGER NOT NULL DEFAULT 0,
    "subscription_status" TEXT,
    "stripe_subscription_id" TEXT,
    "last_purchase" TIMESTAMP(3),
    "trust_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "stripe_session_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_invoice_id" TEXT,
    "schools_count" INTEGER,
    "unit_price" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Content" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "content_type" JSONB NOT NULL,
    "text_content" JSONB NOT NULL,
    "attachment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PostMethod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "post_address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "PostMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentRecipient" (
    "id" SERIAL NOT NULL,
    "content_id" INTEGER,
    "recipient" TEXT NOT NULL,
    "method_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "ContentRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "options" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Response" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Answer" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "response_id" INTEGER NOT NULL,
    "answer_text" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_verification_token_key" ON "public"."User"("email_verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "User_password_reset_token_key" ON "public"."User"("password_reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "School_email_key" ON "public"."School"("email");

-- CreateIndex
CREATE UNIQUE INDEX "School_user_id_key" ON "public"."School"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_user_id_key" ON "public"."Profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripe_subscription_id_key" ON "public"."Organization"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripe_session_id_key" ON "public"."Payment"("stripe_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripe_invoice_id_key" ON "public"."Payment"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "Payment_organization_id_status_idx" ON "public"."Payment"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Payment_stripe_session_id_idx" ON "public"."Payment"("stripe_session_id");

-- CreateIndex
CREATE INDEX "Payment_stripe_invoice_id_idx" ON "public"."Payment"("stripe_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PostMethod_name_key" ON "public"."PostMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_response_id_question_id_key" ON "public"."Answer"("response_id", "question_id");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."School" ADD CONSTRAINT "School_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."School" ADD CONSTRAINT "School_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Content" ADD CONSTRAINT "Content_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRecipient" ADD CONSTRAINT "ContentRecipient_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRecipient" ADD CONSTRAINT "ContentRecipient_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."PostMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentRecipient" ADD CONSTRAINT "ContentRecipient_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Question" ADD CONSTRAINT "Question_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
