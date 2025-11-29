/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private baseUrl: string;
  // normalize a stored unit_price which may be in pence (e.g. 1000) or pounds (e.g. 10)
  private normalizeUnitPriceForComparison(
    unitPrice: number | null | undefined,
    amount?: number | null,
  ) {
    if (unitPrice == null) return amount ?? null;
    // heuristics: if > 100 treat as pence -> convert to pounds
    if (unitPrice > 100) return unitPrice / 100;
    return unitPrice;
  }

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2025-03-31.basil',
      },
    );

    this.baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Creates a Stripe checkout session for trust or single plan
   */
  async createCheckoutSession(
    plan: 'trust' | 'single',
    organizationId: number,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        selected_school_count: true,
        is_trust: true,
        trust_locked: true, // ✅ included and matches schema
        schools: {
          select: {
            id: true,
            is_paid: true,
          },
        },
      },
    });

    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    // ────────── TRUST PLAN ──────────
    if (plan === 'trust') {
      if (!org.is_trust) {
        throw new HttpException(
          'Organization is not a trust',
          HttpStatus.BAD_REQUEST,
        );
      }

      const selectedCount = org.selected_school_count ?? 0;
      const createdCount = org.schools?.length ?? 0;
      if (createdCount === 0) {
        throw new HttpException(
          'At least one school must exist before payment',
          HttpStatus.BAD_REQUEST,
        );
      }

      // ✅ Count of schools currently marked as paid
      const paidCount = await this.prisma.school.count({
        where: { organization_id: org.id, is_paid: true },
      });

      // Only charge for *new* schools
      const newSchools = createdCount - paidCount;
      if (newSchools <= 0) {
        throw new HttpException(
          'No new schools to charge',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Pricing rule:
      // Case A: created < selected → £50 each
      // Case B: created >= selected → £10 each
      const unitPricePence =
        org.trust_locked || createdCount >= selectedCount ? 1000 : 5000;
      const totalAmount = (unitPricePence * newSchools) / 100;

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: 'Trust Plan - Schools Subscription',
                description: `${newSchools} school(s)`,
              },
              unit_amount: unitPricePence,
              recurring: { interval: 'month' },
            },
            quantity: newSchools,
          },
        ],
        success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.baseUrl}/cancel`,
        metadata: {
          organizationId: org.id.toString(),
          plan,
          newSchools: newSchools.toString(),
          unitPrice: (unitPricePence / 100).toString(),
        },
      });

      await this.prisma.payment.create({
        data: {
          organization_id: org.id,
          amount: totalAmount,
          currency: 'GBP',
          status: 'pending',
          description: `Trust plan for ${newSchools} school(s)`,
          stripe_session_id: session.id,
          schools_count: newSchools,
          unit_price: unitPricePence / 100,
        },
      });

      return { id: session.id, url: session.url };
    }

    // ────────── SINGLE-SCHOOL PLAN ──────────
    // if (plan === 'single') {
    //   if (org.is_trust) {
    //     throw new HttpException(
    //       'Trust organizations must use the trust plan',
    //       HttpStatus.BAD_REQUEST,
    //     );
    //   }

    //   // Only 1 school allowed, always £50
    //   // const unitPricePence = 5000;
    //   // const session = await this.stripe.checkout.sessions.create({
    //   //   mode: 'subscription',
    //   //   payment_method_types: ['card'],
    //   //   line_items: [
    //   //     {
    //   //       price_data: {
    //   //         currency: 'gbp',
    //   //         product_data: { name: 'Single School Plan' },
    //   //         unit_amount: unitPricePence,
    //   //         recurring: { interval: 'month' },
    //   //       },
    //   //       quantity: 1,
    //   //     },
    //   //   ],
    //   //   success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    //   //   cancel_url: `${this.baseUrl}/cancel`,
    //   //   metadata: { organizationId: org.id.toString(), plan },
    //   // });

    //   // Only for special school with 6-month subscription
    //   const school = await this.prisma.school.findFirst({
    //     where: { organization_id: org.id, is_special: true },
    //   });

    //   if (school && school.id === 1) {
    //     // special school only
    //     const unitPricePence = 5000;
    //     await this.stripe.checkout.sessions.create({
    //       mode: 'subscription',
    //       payment_method_types: ['card'],
    //       line_items: [
    //         {
    //           price_data: {
    //             currency: 'gbp',
    //             product_data: { name: 'Single School Plan - 6 Months' },
    //             unit_amount: unitPricePence,
    //             recurring: { interval: 'month', interval_count: 6 }, // 6-month subscription
    //           },
    //           quantity: 1,
    //         },
    //       ],
    //       success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    //       cancel_url: `${this.baseUrl}/cancel`,
    //       metadata: {
    //         organizationId: org.id.toString(),
    //         plan,
    //         schoolId: school.id,
    //       },
    //     });
    //   }

    //   await this.prisma.payment.create({
    //     data: {
    //       organization_id: org.id,
    //       amount: unitPricePence / 100,
    //       currency: 'GBP',
    //       status: 'pending',
    //       description: 'Single school subscription',
    //       stripe_session_id: session.id,
    //       schools_count: 1,
    //       unit_price: unitPricePence / 100,
    //     },
    //   });

    //   return { id: session.id, url: session.url };
    // }
    // ────────── SINGLE-SCHOOL PLAN ──────────
    if (plan === 'single') {
      if (org.is_trust) {
        throw new HttpException(
          'Trust organizations must use the trust plan',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Only for special school with 6-month subscription
      const school = await this.prisma.school.findFirst({
        where: {
          organization_id: org.id,
          is_special: true,
          email: { not: 'lifetime_school_email@example.com' }, // skip lifetime
        },
      });

      if (school && school.id === 1) {
        // special school only
        const unitPricePence = 5000;
        const session = await this.stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                product_data: { name: 'Single School Plan - 6 Months' },
                unit_amount: unitPricePence,
                recurring: { interval: 'month', interval_count: 6 }, // 6-month subscription
              },
              quantity: 1,
            },
          ],
          success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.baseUrl}/cancel`,
          metadata: {
            organizationId: org.id.toString(),
            plan,
            schoolId: school.id,
          },
        });

        await this.prisma.payment.create({
          data: {
            organization_id: org.id,
            amount: unitPricePence / 100,
            currency: 'GBP',
            status: 'pending',
            description: 'Single school subscription',
            stripe_session_id: session.id,
            schools_count: 1,
            unit_price: unitPricePence / 100,
          },
        });

        return { id: session.id, url: session.url };
      } else {
        // normal single school logic (monthly subscription)
        const unitPricePence = 5000; // £50 per month
        const session = await this.stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                product_data: { name: 'Single School Plan' },
                unit_amount: unitPricePence,
                recurring: { interval: 'month' }, // normal monthly
              },
              quantity: 1,
            },
          ],
          success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.baseUrl}/cancel`,
          metadata: {
            organizationId: org.id.toString(),
            plan,
          },
        });

        await this.prisma.payment.create({
          data: {
            organization_id: org.id,
            amount: unitPricePence / 100,
            currency: 'GBP',
            status: 'pending',
            description: 'Single school subscription',
            stripe_session_id: session.id,
            schools_count: 1,
            unit_price: unitPricePence / 100,
          },
        });

        return { id: session.id, url: session.url };
      }
    }

    throw new HttpException('Invalid plan type', HttpStatus.BAD_REQUEST);
  }

  /**
   * Mark payment as successful after webhook/session completion
   */
  async markPaymentSuccess(stripeSessionId: string) {
    // ────────── Retrieve Stripe session ──────────
    let fullSession: Stripe.Checkout.Session;
    try {
      fullSession = await this.stripe.checkout.sessions.retrieve(
        stripeSessionId,
        { expand: ['subscription', 'invoice'] },
      );
    } catch (err) {
      console.error('Failed to retrieve Stripe session', stripeSessionId, err);
      throw new HttpException('Invalid Stripe session', HttpStatus.BAD_REQUEST);
    }

    const meta = fullSession.metadata ?? {};
    const organizationId = Number(meta.organizationId);
    if (!organizationId) {
      throw new HttpException(
        'Missing or invalid organizationId in session metadata',
        HttpStatus.BAD_REQUEST,
      );
    }

    const subscriptionId =
      typeof fullSession.subscription === 'string'
        ? fullSession.subscription
        : ((fullSession.subscription as Stripe.Subscription | null)?.id ??
          null);

    const invoiceId =
      typeof fullSession.invoice === 'string'
        ? fullSession.invoice
        : ((fullSession.invoice as Stripe.Invoice | null)?.id ?? null);

    // ────────── Locate or create Payment row ──────────
    let paymentRow = await this.prisma.payment.findFirst({
      where: {
        stripe_session_id: stripeSessionId,
        organization_id: organizationId,
      },
    });

    if (!paymentRow) {
      // fallback if webhook beats DB insert
      const amountPaid =
        (fullSession.amount_total ?? 0) / 100 ||
        (fullSession.amount_subtotal ?? 0) / 100;

      paymentRow = await this.prisma.payment.create({
        data: {
          organization_id: organizationId,
          amount: amountPaid,
          currency: (fullSession.currency ?? 'GBP').toUpperCase(),
          status: 'pending',
          description:
            meta.plan === 'trust'
              ? `Trust plan for ${meta.newSchools ?? 0} school(s)`
              : 'Single school subscription',
          stripe_session_id: stripeSessionId,
          stripe_subscription_id: subscriptionId ?? undefined,
          stripe_invoice_id: invoiceId ?? undefined,
          schools_count: meta.newSchools ? Number(meta.newSchools) : 0,
          unit_price: meta.unitPrice ? Number(meta.unitPrice) : 0,
        },
      });
    }

    // ────────── Mark payment success ──────────
    await this.prisma.payment.update({
      where: { id: paymentRow.id },
      data: {
        status: 'success',
        stripe_subscription_id: subscriptionId ?? undefined,
        stripe_invoice_id: invoiceId ?? undefined,
      },
    });

    // ────────── Update organization’s paid-school totals ──────────
    const agg = await this.prisma.payment.aggregate({
      _sum: { schools_count: true },
      where: { organization_id: organizationId, status: 'success' },
    });
    const totalPaidSchools = agg._sum.schools_count ?? 0;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { paid_school_count: totalPaidSchools },
    });

    const orgData = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { trust_locked: true, selected_school_count: true },
    });
    const currentCreated = await this.prisma.school.count({
      where: { organization_id: organizationId },
    });

    if (
      !orgData?.trust_locked &&
      orgData?.selected_school_count &&
      currentCreated >= orgData.selected_school_count
    ) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { trust_locked: true },
      });
    }

    // ────────── Mark newly paid schools as paid ──────────
    // if (paymentRow.schools_count > 0) {
    //   const unpaid = await this.prisma.school.findMany({
    //     where: { organization_id: organizationId, is_paid: false },
    //     take: paymentRow.schools_count,
    //     select: { id: true },
    //   });

    //   if (unpaid.length) {
    //     await this.prisma.school.updateMany({
    //       where: { id: { in: unpaid.map((s) => s.id) } },
    //       data: { is_paid: true },
    //     });
    //   }
    // }
    // Only mark the special school as paid and set 6-month subscription_end
    // Skip lifetime school completely
    const specialSchool = await this.prisma.school.findFirst({
      where: {
        organization_id: organizationId,
        is_special: true,
        email: { not: 'lifetime_school_email@example.com' }, // exclude lifetime
      },
    });

    if (specialSchool) {
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

      await this.prisma.school.update({
        where: { id: specialSchool.id },
        data: {
          is_paid: true,
          subscription_end: sixMonthsLater,
        },
      });
    }

    const normalSchool = await this.prisma.school.findFirst({
      where: {
        organization_id: organizationId,
        is_special: false,
        email: { not: 'lifetime_school_email@example.com' }, // exclude lifetime
      },
    });

    if (normalSchool) {
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      await this.prisma.school.update({
        where: { id: normalSchool.id },
        data: { is_paid: true, subscription_end: oneMonthLater },
      });
    }

    if (normalSchool) {
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      await this.prisma.school.update({
        where: { id: normalSchool.id },
        data: { is_paid: true, subscription_end: oneMonthLater },
      });
    }

    // ────────── Update subscription info & send receipt ──────────
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stripe_subscription_id: subscriptionId ?? undefined,
        subscription_status: 'active',
        last_purchase: new Date(),
      },
      include: {
        profiles: {
          take: 1,
          select: { first_name: true, user: { select: { email: true } } },
        },
      },
    });

    const email = org.profiles?.[0]?.user?.email;
    if (email) {
      try {
        await this.emailService.sendPaymentReceipt(
          email,
          paymentRow.amount,
          paymentRow.currency,
          org.profiles?.[0]?.first_name ?? '',
          org.name,
          paymentRow.description,
          new Date(),
        );
      } catch (err) {
        console.error('Failed to send payment receipt', err);
      }
    }

    console.log('markPaymentSuccess: completed for', stripeSessionId);
    return { success: true };
  }

  async sendSubscriptionExpiryReminder(
    email: string,
    details: {
      firstName?: string;
      orgName: string;
      plan: string;
      expiryDate: string;
      amount: number;
      currency: string;
    },
  ) {
    // Delegates to EmailService
    await this.emailService.sendSubscriptionExpiryReminder(email, details);
  }
}
