/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/email/email.service';
import { LIFETIME_SCHOOL_EMAIL } from './payment.service';

export const SIX_MONTH_SCHOOL_EMAIL = 'a.gillings@blundeston.suffolk.sch.uk';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService, // Inject EmailService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // @Cron('*/55 * * * * *')
  async handleExpiredSubscriptions() {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // Find schools expiring in next 7 days (for reminders)
    const expiringSchools = await this.prisma.school.findMany({
      where: {
        is_paid: true,
        subscription_end: { gte: now, lte: sevenDaysLater },
        email: {
          notIn: [LIFETIME_SCHOOL_EMAIL], // exclude lifetime
        },
      },
    });

    // Send reminders
    await this.sendSubscriptionExpiryReminder(expiringSchools);

    // Mark ONLY schools with FAILED subscription payments as unpaid
    // Get all organizations with canceled/past_due subscriptions
    // ✅ IMPROVED: Only mark schools unpaid if subscription_end is past AND org has failed subscription
    const failedOrgsWithActive = await this.prisma.organization.findMany({
      where: {
        subscription_status: { in: ['canceled', 'past_due'] },
      },
      select: { id: true },
    });

    const failedOrgIds = failedOrgsWithActive.map((o) => o.id);

    // Mark schools unpaid ONLY if their org subscription failed
    if (failedOrgIds.length > 0) {
      await this.prisma.school.updateMany({
        where: {
          organization_id: { in: failedOrgIds },
          is_paid: true,
          subscription_end: { lt: new Date() },
          email: { not: LIFETIME_SCHOOL_EMAIL },
        },
        data: { is_paid: false },
      });
    }

    // ✅ ALSO mark schools unpaid if subscription_end expired by 3+ days (webhook delay buffer)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await this.prisma.school.updateMany({
      where: {
        is_paid: true,
        subscription_end: { lt: threeDaysAgo }, // ✅ 3-day grace period
        email: { not: LIFETIME_SCHOOL_EMAIL },
      },
      data: { is_paid: false },
    });

    console.log('Subscription check completed.');
  }

  @Cron(CronExpression.EVERY_HOUR)
  // @Cron('*/2 * * * *') // For testing: every 2 minutes
  async handleExpiredTrials() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Find trials that expired within the last hour
      const expiredTrials = await this.prisma.school.findMany({
        where: {
          is_trial: true,
          trial_ends_at: {
            lt: now,
            gte: oneHourAgo,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          trial_ends_at: true,
        },
      });

      if (!expiredTrials.length) {
        console.log('No expired trials found.');
        return;
      }

      console.log(`Found ${expiredTrials.length} expired trials.`);

      // Send follow-up emails
      for (const school of expiredTrials) {
        try {
          await this.emailService.sendTrialExpiredEmail(school.email, {
            schoolName: school.name,
            expiredAt: school.trial_ends_at?.toISOString(),
          });

          console.log(`Trial expiry email sent to ${school.email}`);
        } catch (emailError) {
          console.error(
            `Failed to send trial expiry email to ${school.email}`,
            emailError,
          );
        }
      }

      // Disable trials
      await this.prisma.school.updateMany({
        where: {
          id: { in: expiredTrials.map((s) => s.id) },
        },
        data: {
          is_trial: false,
        },
      });

      console.log(
        `Trials expired and disabled for: ${expiredTrials
          .map((s) => s.name)
          .join(', ')}`,
      );
    } catch (error) {
      console.error('Error processing expired trials', error);
    }
  }

  // Send subscription expiry reminder emails
  private async sendSubscriptionExpiryReminder(schools: any[]) {
    const lifetimeSchoolEmail = LIFETIME_SCHOOL_EMAIL;

    for (const school of schools) {
      if (school.email === lifetimeSchoolEmail) continue; // skip lifetime school

      const { subscription_end, name, email } = school;
      const expiryDate = new Date(subscription_end);
      const daysToExpiry = Math.floor(
        (expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24),
      );

      if (daysToExpiry <= 7) {
        await this.emailService.sendSubscriptionExpiryReminder(email, {
          firstName: name,
          orgName: name,
          plan: 'single', // or dynamically assign if needed
          expiryDate: expiryDate.toLocaleDateString(),
        });
      }
    }
  }
}
