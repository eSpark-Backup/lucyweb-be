/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  // This cron job will run every day at midnight (or set your preferred schedule)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    const now = new Date();

    // Handle regular schools (monthly expiration)
    await this.prisma.school.updateMany({
      where: {
        is_special: false,
        is_paid: true,
        subscription_end: {
          lt: now, // Subscription has ended
        },
      },
      data: {
        is_paid: false, // Set to false when expired
      },
    });

    // Handle special schools (6-month expiration)
    await this.prisma.school.updateMany({
      where: {
        is_special: true,
        is_paid: true,
        subscription_end: {
          lt: now, // Subscription has ended
        },
      },
      data: {
        is_paid: false, // Set to false when expired
      },
    });

    console.log('Expired subscriptions handled successfully.');
  }
}
