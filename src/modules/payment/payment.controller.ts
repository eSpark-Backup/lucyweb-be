import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('stripe')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a Stripe checkout session
   */
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body('plan') plan: 'trust' | 'single',
    @Body('organizationId') organizationId: number,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'organizationId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const session = await this.paymentService.createCheckoutSession(
        plan,
        organizationId,
      );
      return { success: true, data: session };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to create checkout session',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mark payment as successful
   * Can be called via Stripe webhook or frontend after successful checkout
   */
  @Post('success')
  async paymentSuccess(@Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException('sessionId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.paymentService.markPaymentSuccess(sessionId);
      return { success: true, data: result };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to mark payment as success',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
