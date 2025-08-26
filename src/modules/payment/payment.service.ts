import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private baseUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2025-03-31.basil',
      },
    );

    this.baseUrl =
      this.configService.get<string>('EXPOSURE_FRONTEND') ||
      'http://localhost:3000';
  }

  /**
   * Creates a Stripe checkout session for a single school or trust plan
   * @param plan 'trust' | 'single'
   * @param organizationId ID of the organization making the payment
   */
  async createCheckoutSession(
    plan: 'trust' | 'single',
    organizationId: number,
  ) {
    // Fetch organization to calculate amount
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    let amount: number;
    let description: string;

    if (plan === 'trust') {
      if (
        !organization.selected_school_count ||
        organization.selected_school_count < 2
      ) {
        throw new HttpException(
          'Trust must select at least 2 schools',
          HttpStatus.BAD_REQUEST,
        );
      }
      // £10 per school
      amount = organization.selected_school_count * 1000; // in pence
      description = `Trust Plan: £10 per school for ${organization.selected_school_count} schools`;
    } else {
      // Single school plan
      amount = 5000; // £50 in pence
      description = 'Single School Plan';
    }

    try {
      // Create Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name:
                  plan === 'trust'
                    ? 'Multi Academy Trust Plan'
                    : 'Single School Plan',
                description,
              },
              unit_amount: amount,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.baseUrl}/cancel`,
        metadata: {
          organizationId: organization.id.toString(),
          plan,
        },
      });

      // Optionally create a pending payment record in DB
      await this.prisma.payment.create({
        data: {
          organization_id: organization.id,
          amount: amount / 100, // store in pounds
          currency: 'GBP',
          status: 'pending',
          description,
        },
      });

      return { id: session.id };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to create checkout session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mark payment as successful in the database
   */
  async markPaymentSuccess(stripeSessionId: string) {
    // Fetch session from Stripe
    const session =
      await this.stripe.checkout.sessions.retrieve(stripeSessionId);

    if (!session || !session.metadata || !session.metadata.organizationId) {
      throw new HttpException('Invalid Stripe session', HttpStatus.BAD_REQUEST);
    }

    const organizationId = parseInt(session.metadata.organizationId);

    // Update the pending payment to success
    await this.prisma.payment.updateMany({
      where: {
        organization_id: organizationId,
        status: 'pending',
      },
      data: { status: 'success' },
    });

    // Update organization subscription status
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { subscription_status: 'active', last_purchase: new Date() },
    });

    return { success: true };
  }
}
