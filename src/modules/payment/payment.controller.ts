import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.USER, Role.MODERATOR)
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a Stripe checkout session
   * - Trust orgs → recurring per new schools
   * - Single orgs → recurring per organization
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
      return {
        success: true,
        data: {
          sessionId: session.id,
          checkoutUrl: session.url,
        },
      };
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
   * - Called after Stripe redirect OR by webhook handler
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
  @Post('cancel-subscription')
  async cancelSubscription(@Body('organizationId') organizationId: number) {
    if (!organizationId) {
      throw new HttpException(
        'organizationId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.paymentService.cancelSubscription(organizationId);
  }
}
