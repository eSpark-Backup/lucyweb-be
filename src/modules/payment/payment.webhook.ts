/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/modules/payment/payment.webhook.ts */
import {
  Controller,
  Post,
  Req,
  Res,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Controller('payment')
export class PaymentWebhookController {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-03-31.basil',
    });
  }

  // @Post('webhook')
  // async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
  //   const sig = (req.headers['stripe-signature'] as string) || '';
  //   const webhookSecret = this.config.get<string>(
  //     'STRIPE_WEBHOOK_SECRET',
  //   ) as string;

  //   let event: Stripe.Event;
  //   try {
  //     event = this.stripe.webhooks.constructEvent(
  //       req.body as any,
  //       sig,
  //       webhookSecret,
  //     );
  //   } catch (err: any) {
  //     console.error(
  //       '⚠️  Webhook signature verification failed.',
  //       err?.message || err,
  //     );
  //     return res
  //       .status(400)
  //       .send(`Webhook Error: ${err?.message || 'Invalid signature'}`);
  //   }

  //   try {
  //     switch (event.type) {
  //       // first time checkout subscription created via Checkout
  //       case 'checkout.session.completed': {
  //         const session = event.data.object as Stripe.Checkout.Session;
  //         // session.subscription is a string (subscription id) for subscription checkouts
  //         const subscriptionId = session.subscription as unknown as
  //           | string
  //           | undefined;
  //         const orgIdMeta = session.metadata?.organizationId;

  //         if (subscriptionId && orgIdMeta) {
  //           const orgId = Number(orgIdMeta);
  //           if (Number.isFinite(orgId)) {
  //             await this.prisma.organization.updateMany({
  //               where: { id: orgId },
  //               data: {
  //                 stripe_subscription_id: subscriptionId,
  //                 subscription_status: 'active',
  //                 last_purchase: new Date(),
  //               },
  //             });
  //           } else {
  //             console.warn(
  //               'checkout.session.completed: organizationId metadata is not a number',
  //               orgIdMeta,
  //             );
  //           }
  //         }
  //         break;
  //       }

  //       // recurring invoice paid (initial invoice for subscription also triggers this)
  //       case 'invoice.payment_succeeded': {
  //         const invoice = event.data.object as Stripe.Invoice;
  //         // Stripe typings may present subscription as string | Subscription | undefined
  //         const subscriptionId =
  //           ((invoice as any).subscription as string | null) ?? null;
  //         if (subscriptionId) {
  //           // find org by stripe_subscription_id and record payment
  //           const org = await this.prisma.organization.findFirst({
  //             where: { stripe_subscription_id: subscriptionId },
  //             select: { id: true },
  //           });

  //           if (org) {
  //             await this.prisma.payment.create({
  //               data: {
  //                 organization_id: org.id,
  //                 amount: (invoice.amount_paid ?? 0) / 100,
  //                 currency: (invoice.currency ?? 'gbp').toUpperCase(),
  //                 status: 'success',
  //                 description: 'Recurring subscription payment',
  //                 stripe_invoice_id: invoice.id,
  //                 stripe_subscription_id: subscriptionId,
  //                 created_at: new Date(),
  //               },
  //             });

  //             // ensure organization is active and update last_purchase
  //             await this.prisma.organization.update({
  //               where: { id: org.id },
  //               data: {
  //                 subscription_status: 'active',
  //                 last_purchase: new Date(),
  //               },
  //             });
  //           } else {
  //             console.warn(
  //               `No organization found for subscription ${subscriptionId}`,
  //             );
  //           }
  //         }
  //         break;
  //       }

  //       // invoice payment failed → mark org past_due
  //       case 'invoice.payment_failed': {
  //         const invoice = event.data.object as Stripe.Invoice;
  //         const subscriptionId =
  //           ((invoice as any).subscription as string | null) ?? null;
  //         if (subscriptionId) {
  //           await this.prisma.organization.updateMany({
  //             where: { stripe_subscription_id: subscriptionId },
  //             data: { subscription_status: 'past_due' },
  //           });
  //         }
  //         break;
  //       }

  //       // subscription cancelled
  //       case 'customer.subscription.deleted': {
  //         const subscription = event.data.object as Stripe.Subscription;
  //         await this.prisma.organization.updateMany({
  //           where: { stripe_subscription_id: subscription.id },
  //           data: { subscription_status: 'canceled' },
  //         });
  //         break;
  //       }

  //       // subscription updated (status changes, trial end, etc.)
  //       case 'customer.subscription.updated': {
  //         const subscription = event.data.object as Stripe.Subscription;
  //         await this.prisma.organization.updateMany({
  //           where: { stripe_subscription_id: subscription.id },
  //           data: {
  //             subscription_status: subscription.status,
  //           },
  //         });
  //         break;
  //       }

  //       default:
  //         console.log(`Received unhandled event type: ${event.type}`);
  //     }

  //     // acknowledge to Stripe
  //     return res.status(200).json({ received: true });
  //   } catch (err) {
  //     console.error('Webhook handler error', err);
  //     // Respond with 500 so Stripe will retry
  //     return res.status(500).send('Webhook handling failed');
  //   }
  // }

  @Post('webhook')
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    // Temporarily bypass signature verification
    let event: Stripe.Event;
    try {
      event = req.body as Stripe.Event; // Directly assign req.body
    } catch (err: any) {
      console.error('⚠️ Failed to parse webhook event.', err?.message || err);
      return res
        .status(400)
        .send(`Webhook Error: ${err?.message || 'Invalid body'}`);
    }

    try {
      switch (event.type) {
        // first time checkout subscription created via Checkout
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const subscriptionId = session.subscription as unknown as
            | string
            | undefined;
          const orgIdMeta = session.metadata?.organizationId;

          if (subscriptionId && orgIdMeta) {
            const orgId = Number(orgIdMeta);
            if (Number.isFinite(orgId)) {
              await this.prisma.organization.updateMany({
                where: { id: orgId },
                data: {
                  stripe_subscription_id: subscriptionId,
                  subscription_status: 'active',
                  last_purchase: new Date(),
                },
              });
            } else {
              console.warn(
                'checkout.session.completed: organizationId metadata is not a number',
                orgIdMeta,
              );
            }
          }
          break;
        }

        // recurring invoice paid
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

        // invoice payment failed → mark org past_due
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

        // subscription cancelled
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.prisma.organization.updateMany({
            where: { stripe_subscription_id: subscription.id },
            data: { subscription_status: 'canceled' },
          });
          break;
        }

        // subscription updated
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

        default:
          console.log(`Received unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook handler error', err);
      return res.status(500).send('Webhook handling failed');
    }
  }

  // helper (kept if you want to reuse)
  private async findOrganizationIdByStripeSubscription(
    subscriptionId: string,
  ): Promise<number> {
    const org = await this.prisma.organization.findFirst({
      where: { stripe_subscription_id: subscriptionId },
      select: { id: true },
    });
    if (!org)
      throw new HttpException(
        'Organization not found for subscription',
        HttpStatus.NOT_FOUND,
      );
    return org.id;
  }
}
