/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/email/email.service';
import { LIFETIME_SCHOOL_EMAIL } from './payment.service';

// export const SIX_MONTH_SCHOOL_EMAIL = 'a.gillings@blundeston.suffolk.sch.uk';
export const SIX_MONTH_SCHOOL_EMAIL = 'caxoc91404@roastic.com';

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService, // Inject EmailService
  ) {}

  // This cron job will run every day at midnight (or set your preferred schedule)
  //@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  @Cron('*/10 * * * * *')
  async handleExpiredSubscriptions() {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const regularSchoolsToUpdate = await this.prisma.school.findMany({
      where: {
        is_special: false,
        is_paid: true,
        subscription_end: { gte: now, lte: sevenDaysLater }, // upcoming 7 days
      },
    });

    // ----------------- 6-Month subscription school -----------------
    const sixMonthSchoolEmail = `${SIX_MONTH_SCHOOL_EMAIL}`;
    const sixMonthSchoolsToUpdate = await this.prisma.school.findMany({
      where: {
        is_special: true,
        is_paid: true,
        email: sixMonthSchoolEmail,
        subscription_end: { gte: now, lte: sevenDaysLater },
      },
    });

    // ----------------- Send expiry reminders -----------------
    await this.sendSubscriptionExpiryReminder(regularSchoolsToUpdate);
    await this.sendSubscriptionExpiryReminder(sixMonthSchoolsToUpdate);

    // ----------------- Update subscription status -----------------
    // Regular schools
    await this.prisma.school.updateMany({
      where: {
        is_special: false,
        is_paid: true,
        subscription_end: { lt: now },
      },
      data: { is_paid: false },
    });

    // 6-month school
    await this.prisma.school.updateMany({
      where: {
        is_special: true,
        is_paid: true,
        email: sixMonthSchoolEmail,
        subscription_end: { lt: now },
      },
      data: { is_paid: false },
    });

    console.log('Expired subscriptions handled successfully.');
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
