import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private baseUrl: string;

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
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { schools: true },
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    if (plan === 'trust') {
      if (!organization.is_trust) {
        throw new HttpException(
          'Organization is not a trust',
          HttpStatus.BAD_REQUEST,
        );
      }

      const selectedCount = organization.selected_school_count ?? 0;
      const createdCount = (organization.schools ?? []).length;

      if (createdCount === 0) {
        throw new HttpException(
          'At least one school must be created before payment',
          HttpStatus.BAD_REQUEST,
        );
      }

      // How many schools already paid for
      const totalPaidSchools = await this.prisma.payment.aggregate({
        _sum: { schools_count: true },
        where: { organization_id: organization.id, status: 'success' },
      });
      const paidSchools = totalPaidSchools._sum.schools_count ?? 0;

      // Schools that require payment
      const newSchools = createdCount - paidSchools;
      if (newSchools <= 0) {
        throw new HttpException(
          'No new schools to charge for',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Determine price per school (in pence)
      const unitPrice = createdCount < selectedCount ? 5000 : 1000; // £50 vs £10
      const totalAmount = unitPrice * newSchools;

      try {
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                product_data: {
                  name: 'Trust Plan - Schools Subscription',
                  description: `${newSchools} newly added school(s)`,
                },
                unit_amount: unitPrice,
                recurring: { interval: 'month' },
              },
              quantity: newSchools,
            },
          ],
          mode: 'subscription',
          success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.baseUrl}/cancel`,
          metadata: {
            organizationId: organization.id.toString(),
            plan,
            newSchools: newSchools.toString(),
            unitPrice: unitPrice.toString(),
          },
        });

        await this.prisma.payment.create({
          data: {
            organization_id: organization.id,
            amount: totalAmount / 100, // convert to GBP
            currency: 'GBP',
            status: 'pending',
            description: `Payment for ${newSchools} school(s)`,
            stripe_session_id: session.id,
            schools_count: newSchools,
            unit_price: unitPrice,
          },
        });

        return { id: session.id, url: session.url };
      } catch (error) {
        console.error(error);
        throw new HttpException(
          'Failed to create checkout session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // ------------------ Single School Plan ------------------
    else {
      const unitAmount = 5000; // £50 monthly subscription
      try {
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'gbp',
                product_data: { name: 'Single School Plan' },
                unit_amount: unitAmount,
                recurring: { interval: 'month' },
              },
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${this.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.baseUrl}/cancel`,
          metadata: { organizationId: organization.id.toString(), plan },
        });

        await this.prisma.payment.create({
          data: {
            organization_id: organization.id,
            amount: unitAmount / 100,
            currency: 'GBP',
            status: 'pending',
            description: 'Single school subscription',
            stripe_session_id: session.id,
            schools_count: 1,
            unit_price: unitAmount,
          },
        });

        return { id: session.id, url: session.url };
      } catch (error) {
        console.error(error);
        throw new HttpException(
          'Failed to create checkout session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Mark payment as successful after webhook/session completion
   */
  async markPaymentSuccess(stripeSessionId: string) {
    // Retrieve session and expand subscription & invoice to get all useful fields
    let fullSession: Stripe.Checkout.Session;
    try {
      fullSession = await this.stripe.checkout.sessions.retrieve(
        stripeSessionId,
        {
          expand: ['subscription', 'invoice'],
        },
      );
    } catch (err) {
      console.error(
        'markPaymentSuccess: failed to retrieve session',
        stripeSessionId,
        err,
      );
      throw new HttpException(
        'Failed to retrieve Stripe session',
        HttpStatus.BAD_REQUEST,
      );
    }

    const metadataOrgId = fullSession.metadata?.organizationId;
    if (!metadataOrgId) {
      console.error(
        'markPaymentSuccess: missing organizationId metadata for session',
        stripeSessionId,
      );
      throw new HttpException(
        'Invalid Stripe session (missing metadata)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const organizationId = parseInt(metadataOrgId, 10);
    if (!Number.isFinite(organizationId)) {
      console.error(
        'markPaymentSuccess: invalid organizationId metadata',
        metadataOrgId,
        'session',
        stripeSessionId,
      );
      throw new HttpException(
        'Invalid organizationId in session metadata',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get subscription/invoice ids if available
    const subscriptionId =
      typeof fullSession.subscription === 'string'
        ? fullSession.subscription
        : ((fullSession.subscription as Stripe.Subscription | null)?.id ??
          null);

    const invoiceId =
      typeof fullSession.invoice === 'string'
        ? fullSession.invoice
        : ((fullSession.invoice as any)?.id ?? null);

    // Try to find existing payment row
    let paymentRow = await this.prisma.payment.findFirst({
      where: {
        stripe_session_id: stripeSessionId,
        organization_id: organizationId,
      },
    });

    // If not found, create fallback payment row
    if (!paymentRow) {
      console.warn(
        'markPaymentSuccess: no payment row found for session, creating fallback',
        stripeSessionId,
      );

      let amountFloat = 0;
      if (invoiceId) {
        try {
          const invoice = await this.stripe.invoices.retrieve(invoiceId);
          amountFloat = (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100;
        } catch (err) {
          console.warn(
            'markPaymentSuccess: failed to retrieve invoice to determine amount',
            invoiceId,
            err,
          );
        }
      }

      paymentRow = await this.prisma.payment.create({
        data: {
          organization_id: organizationId,
          amount: amountFloat,
          currency: (fullSession.currency ?? 'GBP').toUpperCase(),
          status: 'pending',
          description: `Checkout (fallback) session ${stripeSessionId}`,
          stripe_session_id: stripeSessionId,
          stripe_subscription_id: subscriptionId,
          stripe_invoice_id: invoiceId ?? undefined,
          created_at: new Date(),
        },
      });
    }

    // Update payment status to success
    await this.prisma.payment.update({
      where: { id: paymentRow.id },
      data: {
        status: 'success',
        stripe_subscription_id: subscriptionId ?? undefined,
        stripe_invoice_id: invoiceId ?? undefined,
      },
    });

    // Mark schools as paid
    if (paymentRow.schools_count && paymentRow.schools_count > 0) {
      const unpaidSchools = await this.prisma.school.findMany({
        where: { organization_id: organizationId, is_paid: false },
        take: paymentRow.schools_count,
      });

      if (unpaidSchools.length > 0) {
        await this.prisma.school.updateMany({
          where: { id: { in: unpaidSchools.map((s) => s.id) } },
          data: { is_paid: true },
        });
      }
    }

    // Update organization and include profiles with user email
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        stripe_subscription_id: subscriptionId ?? undefined,
        subscription_status: 'active',
        last_purchase: new Date(),
      },
      include: {
        profiles: {
          take: 1,
          select: {
            first_name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    // Send payment receipt if email exists
    const recipientEmail = organization.profiles?.[0]?.user?.email;
    const recipientName = organization.profiles?.[0]?.first_name ?? '';
    if (recipientEmail) {
      try {
        await this.emailService.sendPaymentReceipt(
          recipientEmail,
          paymentRow.amount,
          paymentRow.currency,
          recipientName,
          organization.name, // orgName
          paymentRow.description, // or derive a proper planName if available
          new Date(), // paymentDate
        );
      } catch (err) {
        console.error(
          'markPaymentSuccess: failed to send payment receipt',
          err,
        );
      }
    }

    console.log(
      'markPaymentSuccess: completed updates for session',
      stripeSessionId,
      'org',
      organizationId,
    );

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
