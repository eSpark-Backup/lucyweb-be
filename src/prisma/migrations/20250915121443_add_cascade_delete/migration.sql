-- DropForeignKey
ALTER TABLE "public"."Content" DROP CONSTRAINT "Content_event_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_school_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Content" ADD CONSTRAINT "Content_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
