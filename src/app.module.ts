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
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    OrganizationModule,
    AuthModule,
    EventModule,
    StorageModule,
    AiModule,
    AdminModule,
    PaymentModule,
    SchedulerModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
