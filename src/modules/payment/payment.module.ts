import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { EmailService } from '../email/email.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentWebhookController } from './payment.webhook';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, EmailService, JwtService],
  exports: [PaymentService],
})
export class PaymentModule {}
