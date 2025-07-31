import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/email/email.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // @Cron(CronExpression.EVERY_10_SECONDS)
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendEventReminders() {
    this.logger.log('Starting event reminder check...');
    
    try {
      // Calculate the date 5 days from now
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
      
      // Format the date to match the database date format (YYYY-MM-DD)
      const targetDate = fiveDaysFromNow.toISOString().split('T')[0];
      
      this.logger.log(`Checking for events on ${targetDate} (5 days from now)`);

      // Find all events happening in 5 days
      const events = await this.getEventsForDate(targetDate);

      this.logger.log(`Found ${events.length} events happening in 5 days`);

      // Process each event and send reminders
      for (const event of events) {
        await this.sendRemindersForEvent(event);
      }

      this.logger.log('Event reminder check completed successfully');
    } catch (error) {
      this.logger.error('Error in event reminder check:', error);
    }
  }

  /**
   * Get events for a specific date
   * @param targetDate - Date in YYYY-MM-DD format
   * @returns Array of events with their contents and recipients
   */
  async getEventsForDate(targetDate: string) {
    return await this.prisma.event.findMany({
      where: {
        date_time: {
          gte: new Date(`${targetDate}T00:00:00.000Z`),
          lt: new Date(`${targetDate}T23:59:59.999Z`),
        },
      },
      include: {
        contents: {
          include: {
            content_recipients: {
              include: {
                post_method: true,
              },
            },
          },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  private async sendRemindersForEvent(event: any) {
    try {
      this.logger.log(`Processing reminders for event: ${event.name} (ID: ${event.id})`);

      // Get all unique recipients from all contents of this event
      const recipients = new Set<string>();
      const contentDetails: any[] = [];

      for (const content of event.contents) {
        for (const recipient of content.content_recipients) {
          recipients.add(recipient.recipient);
        }
        
        // Store content details for the email
        contentDetails.push({
          type: content.content_type,
          text: content.text_content,
          attachment: content.attachment,
        });
      }

      if (recipients.size === 0) {
        this.logger.log(`No recipients found for event: ${event.name}`);
        return;
      }

      // Create email content
      const emailSubject = `Reminder: Event "${event.name}" in 5 days`;
      const emailBody = this.createReminderEmailBody(event, contentDetails);

      // Send emails to all recipients
      const recipientArray = Array.from(recipients);
      await Promise.all(
        recipientArray.map(async (recipient) => {
          try {
            await this.emailService.sendEmail(recipient, emailSubject, emailBody);
            this.logger.log(`Reminder sent to: ${recipient} for event: ${event.name}`);
          } catch (error) {
            this.logger.error(`Failed to send reminder to ${recipient}:`, error);
          }
        })
      );

      this.logger.log(`Successfully sent reminders for event: ${event.name} to ${recipientArray.length} recipients`);
    } catch (error) {
      this.logger.error(`Error processing reminders for event ${event.id}:`, error);
    }
  }

  private createReminderEmailBody(event: any, contentDetails: any[]): string {
    const eventDate = new Date(event.date_time).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const eventTime = new Date(event.date_time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let contentSection = '';
    if (contentDetails.length > 0) {
      contentSection = `
        <h3 style="color: #4A90E2; margin-top: 20px;">Event Content:</h3>
        ${contentDetails.map((content, index) => `
          <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4A90E2;">
            <h4 style="margin: 0 0 10px 0; color: #333;">Content ${index + 1}: ${content.type}</h4>
            <p style="margin: 0; color: #666;">${content.text}</p>
            ${content.attachment ? `<p style="margin: 10px 0 0 0;"><strong>Attachment:</strong> ${content.attachment}</p>` : ''}
          </div>
        `).join('')}
      `;
    }

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 5px; max-width: 600px;">
        <h2 style="color: #4A90E2; margin-bottom: 20px;">Event Reminder</h2>
        
        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="color: #2c5aa0; margin: 0 0 10px 0;">${event.name}</h3>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${eventTime}</p>
          ${event.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${event.description}</p>` : ''}
        </div>

        <p style="color: #666; font-size: 14px;">
          This event is scheduled to take place in <strong>5 days</strong>. 
          Please make sure you have all the necessary preparations in place.
        </p>

        ${contentSection}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            This is an automated reminder from your event management system.
          </p>
        </div>
      </div>
    `;
  }
} 