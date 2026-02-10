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
import { LIFETIME_SCHOOL_EMAIL, PaymentService } from './payment.service';
import { FIXED_UNIT_PRICE_GBP } from './payment.constants';

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
              return res.status(400).json({
                error: 'Missing session ID in event',
              });
            }
          } catch (err) {
            // log full error so we can see why it failed
            console.error(
              'checkout.session.completed: failed to mark payment success for session:',
              session.id,
              err,
            );
            // ✅ CRITICAL FIX: Return error status so Stripe retries
            return res.status(500).json({
              error: 'Payment processing failed',
              session_id: session.id,
            });
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
              select: { id: true, is_trust: true },
            });

            if (org) {
              // ✅ Get original payment details
              const originalPayment = await this.prisma.payment.findFirst({
                where: {
                  organization_id: org.id,
                  stripe_subscription_id: subscriptionId,
                  status: 'success',
                },
                orderBy: { created_at: 'asc' },
                select: { schools_count: true, unit_price: true },
              });

              // Create payment record
              await this.prisma.payment.create({
                data: {
                  organization_id: org.id,
                  amount: (invoice.amount_paid ?? 0) / 100,
                  currency: (invoice.currency ?? 'gbp').toUpperCase(),
                  status: 'success',
                  description: 'Recurring subscription payment',
                  stripe_invoice_id: invoice.id,
                  stripe_subscription_id: subscriptionId,
                  schools_count: originalPayment?.schools_count ?? 1,
                  // unit_price: originalPayment?.unit_price ?? 50,
                  unit_price:
                    originalPayment?.unit_price ?? FIXED_UNIT_PRICE_GBP,
                  created_at: new Date(),
                },
              });

              // ✅ FIX: Extend subscription for ALL monthly schools
              const oneMonthLater = new Date();
              oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

              await this.prisma.school.updateMany({
                where: {
                  organization_id: org.id,
                  is_paid: true,
                  is_special: false, // Normal monthly schools
                  email: { not: LIFETIME_SCHOOL_EMAIL },
                },
                data: {
                  subscription_end: oneMonthLater,
                },
              });

              // ✅ Handle 6-month special school separately
              const SIX_MONTH_SCHOOL_EMAIL =
                'a.gillings@blundeston.suffolk.sch.uk';
              const sixMonthSchool = await this.prisma.school.findFirst({
                where: {
                  organization_id: org.id,
                  is_special: true,
                  is_paid: true,
                  email: SIX_MONTH_SCHOOL_EMAIL,
                },
              });

              if (sixMonthSchool) {
                // Check if this is a 6-month renewal (Stripe charges every 6 months)
                const sixMonthsLater = new Date();
                sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

                await this.prisma.school.update({
                  where: { id: sixMonthSchool.id },
                  data: { subscription_end: sixMonthsLater },
                });
              }

              // Update organization
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
            const org = await this.prisma.organization.findFirst({
              where: { stripe_subscription_id: subscriptionId },
            });

            if (org) {
              // Mark organization as past_due
              await this.prisma.organization.update({
                where: { id: org.id },
                data: { subscription_status: 'past_due' },
              });

              // Mark schools as unpaid after grace period (optional)
              await this.prisma.school.updateMany({
                where: {
                  organization_id: org.id,
                  is_paid: true,
                  email: { not: LIFETIME_SCHOOL_EMAIL },
                },
                data: { is_paid: false },
              });
            }
          }
          break;
        }

        // Subscription cancelled
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;

          const org = await this.prisma.organization.findFirst({
            where: { stripe_subscription_id: subscription.id },
          });

          if (!org) break;

          // Expire organization subscription
          await this.prisma.organization.update({
            where: { id: org.id },
            data: {
              subscription_status: 'expired',
              stripe_subscription_id: null,
            },
          });

          // Expire all paid schools (except lifetime)
          await this.prisma.school.updateMany({
            where: {
              organization_id: org.id,
              is_paid: true,
              email: { not: LIFETIME_SCHOOL_EMAIL },
            },
            data: {
              is_paid: false,
            },
          });

          break;
        }

        // Subscription updated
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;

          if (subscription.cancel_at_period_end) {
            await this.prisma.organization.updateMany({
              where: { stripe_subscription_id: subscription.id },
              data: {
                subscription_status: 'canceling',
              },
            });
            console.log(
              `Marked organization with subscription ${subscription.id} as canceling`,
            );
          }

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
