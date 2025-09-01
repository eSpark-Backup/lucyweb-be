import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UserModule } from './modules/users/users.module';
import { EventModule } from './modules/event/event.module';
import { StorageModule } from './modules/storage/storage.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/users/admin/admin.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SchoolModule } from './modules/school/school.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventReminderJob } from './jobs/eventReminder.job';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    OrganizationModule,
    EventModule,
    StorageModule,
    AiModule,
    AdminModule,
    PaymentModule,
    SchoolModule,
    ScheduleModule.forRoot(),
    EmailModule,
  ],

  controllers: [],
  providers: [PrismaService, EventReminderJob],
})
export class AppModule {}
