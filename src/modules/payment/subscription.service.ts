/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/email/email.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService, // Inject EmailService
  ) {}

  // This cron job will run every day at midnight (or set your preferred schedule)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    const now = new Date();

    // Handle regular schools (monthly expiration)
    const schoolsToUpdate = await this.prisma.school.findMany({
      where: {
        is_special: false,
        is_paid: true,
        subscription_end: {
          lt: now, // Subscription has ended
        },
      },
    });

    // Handle special schools (6-month expiration)
    // Handle special schools (6-month expiration) via email check
    const specialSchoolsToUpdate = await this.prisma.school.findMany({
      where: {
        is_special: true,
        is_paid: true,
        subscription_end: {
          lt: now, // Subscription has ended
        },
        // Only 6-month school, not lifetime
        email: {
          not: 'lifetime_school@gmail.com',
        },
      },
    });

    // Send reminder emails for schools about to expire (e.g., 7 days before expiration)
    await this.sendSubscriptionExpiryReminder(schoolsToUpdate);
    await this.sendSubscriptionExpiryReminder(specialSchoolsToUpdate);

    // Update subscription status for expired schools
    await this.prisma.school.updateMany({
      where: {
        is_special: true,
        is_paid: true,
        subscription_end: {
          lt: now,
        },
        email: {
          not: 'lifetime_school_email@example.com', // Exclude lifetime school
        },
      },
      data: {
        is_paid: false,
      },
    });

    console.log('Expired subscriptions handled successfully.');
  }

  // Send subscription expiry reminder emails
  private async sendSubscriptionExpiryReminder(schools: any[]) {
    for (const school of schools) {
      if (school.email === 'lifetime_school@gmail.com') {
        continue; // skip sending reminders to lifetime school
      }
      const { subscription_end, name, email } = school;

      // If the subscription is about to expire in the next 7 days
      const expiryDate = new Date(subscription_end);
      const daysToExpiry = Math.floor(
        (expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24),
      );

      if (daysToExpiry <= 7) {
        await this.emailService.sendSubscriptionExpiryReminder(email, {
          firstName: name, // or other relevant fields
          orgName: name,
          plan: 'single', // Add the actual plan name if available
          expiryDate: expiryDate.toLocaleDateString(),
        });
      }
    }
  }
}
