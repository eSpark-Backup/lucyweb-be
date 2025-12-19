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
    // Mark all schools as unpaid if their subscription_end is past, regardless of org status
    await this.prisma.school.updateMany({
      where: {
        is_paid: true,
        subscription_end: { lt: new Date() },
        email: { not: LIFETIME_SCHOOL_EMAIL },
      },
      data: { is_paid: false },
    });
    const failedOrgs = await this.prisma.organization.findMany({
      where: {
        subscription_status: { in: ['canceled', 'past_due'] },
      },
      select: { id: true },
    });

    if (failedOrgs.length > 0) {
      const failedOrgIds = failedOrgs.map((o) => o.id);

      await this.prisma.school.updateMany({
        where: {
          organization_id: { in: failedOrgIds },
          is_paid: true,
          subscription_end: { lt: now },
          email: { not: LIFETIME_SCHOOL_EMAIL },
        },
        data: { is_paid: false },
      });
    }

    console.log('Subscription check completed.');
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
