import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentWebhookController } from './payment.webhook';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
