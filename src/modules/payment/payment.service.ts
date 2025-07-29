import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private baseUrl: string;
  constructor(private configService: ConfigService) {
  //   this.stripe = new Stripe(
  //     this.configService.get<string>('STRIPE_SECRET_KEY'),
  //     {
  //       apiVersion: '2025-03-31.basil',
  //     },
  //   );
  //   this.baseUrl =
  //     this.configService.get<string>('EXPOSURE_FRONTEND') ||
  //     'http://localhost:3000';
  }

  async createCheckoutSession(plan: 'trust' | 'single') {
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
              description:
                plan === 'trust'
                  ? '£10 per school/month for all schools in the trust'
                  : '£50/month for one school',
            },
            unit_amount: plan === 'trust' ? 1000 : 5000, // £10 or £50 in pence
            recurring: { interval: 'month' }, // Subscription
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `http://${this.baseUrl}/success`, // Adjust for your Next.js port
      cancel_url: `http://${this.baseUrl}/cancel`, // Adjust for your Next.js port
    });

    return { id: session.id };
  }
}
