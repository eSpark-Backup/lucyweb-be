/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/modules/payment/payment.webhook.ts */
import {
  Controller,
  Post,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { EmailService } from '../email/email.service';

@Controller('payment')
export class PaymentWebhookController {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paymentService: PaymentService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-03-31.basil',
    });
  }

  @Post('webhook')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const sig = (req.headers['stripe-signature'] as string) || '';
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;

    let event: Stripe.Event;
    try {
      // ✅ Use rawBody (Buffer), not parsed body
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      console.error(
        '⚠️  Webhook signature verification failed:',
        err?.message || err,
      );
      return res
        .status(400)
        .send(`Webhook Error: ${err?.message || 'Invalid signature'}`);
    }

    try {
      switch (event.type) {
        // First-time checkout subscription created via Checkout
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(
            'Received checkout.session.completed for session:',
            session.id,
          );

          try {
            if (session.id) {
              // delegate all DB updates to PaymentService
              await this.paymentService.markPaymentSuccess(session.id);
              console.log(
                'checkout.session.completed handled successfully for session:',
                session.id,
              );
            } else {
              console.warn(
                'checkout.session.completed: missing session id in event',
              );
            }
          } catch (err) {
            // log full error so we can see why it failed
            console.error(
              'checkout.session.completed: failed to mark payment success for session:',
              session.id,
              err,
            );
          }

          break;
        }

        // Recurring invoice paid
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId =
            ((invoice as any).subscription as string | null) ?? null;

          if (subscriptionId) {
            const org = await this.prisma.organization.findFirst({
              where: { stripe_subscription_id: subscriptionId },
              select: { id: true },
            });

            if (org) {
              await this.prisma.payment.create({
                data: {
                  organization_id: org.id,
                  amount: (invoice.amount_paid ?? 0) / 100,
                  currency: (invoice.currency ?? 'gbp').toUpperCase(),
                  status: 'success',
                  description: 'Recurring subscription payment',
                  stripe_invoice_id: invoice.id,
                  stripe_subscription_id: subscriptionId,
                  created_at: new Date(),
                },
              });

              await this.prisma.organization.update({
                where: { id: org.id },
                data: {
                  subscription_status: 'active',
                  last_purchase: new Date(),
                },
              });
            } else {
              console.warn(
                `No organization found for subscription ${subscriptionId}`,
              );
            }
          }
          break;
        }

        // Invoice payment failed → mark org past_due
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId =
            ((invoice as any).subscription as string | null) ?? null;
          if (subscriptionId) {
            await this.prisma.organization.updateMany({
              where: { stripe_subscription_id: subscriptionId },
              data: { subscription_status: 'past_due' },
            });
          }
          break;
        }

        // Subscription cancelled
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.prisma.organization.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: { subscription_status: 'canceled' },
          });
          break;
        }

        // Subscription updated
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.prisma.organization.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: {
              subscription_status: subscription.status,
            },
          });
          break;
        }

        // Notify users about upcoming subscription expiry
        case 'invoice.upcoming': {
          const invoice = event.data.object as any; // workaround for TS typing

          const subscriptionId = invoice.subscription ?? null;
          if (!subscriptionId) break;

          const org = await this.prisma.organization.findFirst({
            where: { stripe_subscription_id: subscriptionId },
            include: {
              profiles: {
                select: {
                  first_name: true,
                  user: { select: { email: true } },
                },
              },
            },
          });

          if (!org || org.profiles.length === 0) {
            console.warn(
              `No profiles with email found for organization ${org?.id} (subscription ${subscriptionId})`,
            );
            break;
          }

          for (const profile of org.profiles) {
            const recipientEmail = profile.user?.email;
            const recipientName = profile.first_name ?? '';
            if (!recipientEmail) continue;

            const lineItem = invoice.lines.data[0] as any;
            const planName = lineItem?.price?.nickname ?? 'Subscription';
            const amount = (invoice.amount_due ?? 0) / 100;
            const currency = (invoice.currency ?? 'GBP').toUpperCase();
            const expiryDate = new Date(
              (invoice.next_payment_attempt ?? 0) * 1000,
            ).toDateString();

            try {
              await this.paymentService.sendSubscriptionExpiryReminder(
                recipientEmail,
                {
                  firstName: recipientName,
                  orgName: org.name,
                  plan: planName,
                  expiryDate,
                  amount,
                  currency,
                },
              );
            } catch (err) {
              console.error(
                `Failed to send subscription expiry reminder to ${recipientEmail}`,
                err,
              );
            }
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook handler error:', err);
      return res.status(500).send('Webhook handling failed');
    }
  }

  private async findOrganizationIdByStripeSubscription(
    subscriptionId: string,
  ): Promise<number> {
    const org = await this.prisma.organization.findFirst({
      where: { stripe_subscription_id: subscriptionId },
      select: { id: true },
    });
    if (!org) {
      throw new HttpException(
        'Organization not found for subscription',
        HttpStatus.NOT_FOUND,
      );
    }
    return org.id;
  }
}
