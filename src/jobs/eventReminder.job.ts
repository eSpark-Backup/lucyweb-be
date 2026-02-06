// src/jobs/eventReminder.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../modules/email/email.service';

@Injectable()
export class EventReminderJob {
  private readonly logger = new Logger(EventReminderJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // Run every midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleEventReminders() {
    this.logger.log('Running event reminder job...');

    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 5); // 5 days before event

    try {
      // Find events starting in exactly 5 days
      const events = await this.prisma.event.findMany({
        where: {
          start_date: {
            gte: new Date(reminderDate.setHours(0, 0, 0, 0)),
            lt: new Date(reminderDate.setHours(23, 59, 59, 999)),
          },
        },
        include: {
          contents: {
            include: {
              content_recipients: true,
            },
          },
        },
      });

      for (const event of events) {
        // Collect all recipients from content_recipients
        const recipients = event.contents.flatMap((c) =>
          c.content_recipients.map((cr) => cr.recipient),
        );

        if (recipients.length > 0) {
          await this.emailService.sendEmail(
            recipients,
            `Reminder: ${event.name} starts in 5 days`,
            `<p>Hello,</p>
             <p>This is a friendly reminder that your event <strong>${event.name}</strong> 
             will start on <strong>${event.start_date.toDateString()}</strong>.</p>
             <p>See you there!</p>`,
          );
        }
      }

      this.logger.log(`Sent reminders for ${events.length} event(s).`);
    } catch (error) {
      this.logger.error('Error running event reminder job:', error);
    }
  }
}
