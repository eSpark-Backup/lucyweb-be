import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a Stripe checkout session
   * - Trust orgs → charge per new schools (logic in PaymentService)
   * - Single orgs → flat recurring subscription
   */
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body('plan') plan: 'trust' | 'single',
    @Body('organizationId') organizationId: number,
  ) {
    if (!plan || !organizationId) {
      throw new HttpException(
        'plan and organizationId are required',
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
      console.error('Error creating checkout session:', error);
      throw new HttpException(
        error.message || 'Failed to create checkout session',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Confirm successful payment
   * - Can be called from webhook or client after Stripe redirect
   */
  @Post('success')
  async markPaymentSuccess(@Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException('sessionId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.paymentService.markPaymentSuccess(sessionId);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error marking payment success:', error);
      throw new HttpException(
        error.message || 'Failed to confirm payment',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
