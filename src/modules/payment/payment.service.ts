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
      include: { schools: true },
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

      // Count of schools already paid for
      const paidAgg = await this.prisma.payment.aggregate({
        _sum: { schools_count: true },
        where: { organization_id: org.id, status: 'success' },
      });
      const paidCount = paidAgg._sum.schools_count ?? 0;

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
      const unitPricePence = createdCount < selectedCount ? 5000 : 1000;
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
    if (plan === 'single') {
      if (org.is_trust) {
        throw new HttpException(
          'Trust organizations must use the trust plan',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Only 1 school allowed, always £50
      const unitPricePence = 5000;
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: { name: 'Single School Plan' },
              unit_amount: unitPricePence,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.baseUrl}/cancel`,
        metadata: { organizationId: org.id.toString(), plan },
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

    // ────────── Mark newly paid schools as paid ──────────
    if (paymentRow.schools_count > 0) {
      const unpaid = await this.prisma.school.findMany({
        where: { organization_id: organizationId, is_paid: false },
        take: paymentRow.schools_count,
        select: { id: true },
      });

      if (unpaid.length) {
        await this.prisma.school.updateMany({
          where: { id: { in: unpaid.map((s) => s.id) } },
          data: { is_paid: true },
        });
      }
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
