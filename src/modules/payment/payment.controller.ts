/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('stripe')
export class PaymentController {
  constructor(private stripeService: PaymentService) {}

  @Post('create-checkout-session')
  async createCheckoutSession(@Body('plan') plan: 'trust' | 'single') {
    try {
      const session = await this.stripeService.createCheckoutSession(plan);
      return session;
    } catch (error) {
      throw new HttpException(
        'Failed to create checkout session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
