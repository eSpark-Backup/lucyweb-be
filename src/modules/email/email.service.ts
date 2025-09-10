import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      SES: new AWS.SES({
        apiVersion: '2010-12-01',
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }),
    });
  }

  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Send verification email
  async sendVerificationEmail(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;

    const subject = 'Verify Your Email Address';
    const body = this.createVerificationEmailBody(verificationUrl, firstName);

    await this.sendEmail(email, subject, body);
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email: string, firstName?: string): Promise<void> {
    const subject = 'Welcome! Your email has been verified';
    const body = this.createWelcomeEmailBody(firstName);

    await this.sendEmail(email, subject, body);
  }

  async sendPaymentReceipt(
    email: string,
    amount: number,
    currency: string,
    firstName?: string,
    orgName?: string,
    planName?: string,
    paymentDate?: Date,
  ): Promise<void> {
    const subject = 'Payment Confirmation Receipt';
    const dateString = paymentDate
      ? paymentDate.toLocaleDateString()
      : new Date().toLocaleDateString();

    const body = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 10px;">
    <h2 style="color: #1E90FF; text-align: center; margin-bottom: 20px;">Payment Successful</h2>
    
    <p style="font-size: 15px; color: #333;">
      ${firstName ? `Hello ${firstName},<br/><br/>` : ''}
      Thank you for your payment. Here are the details of your transaction:
    </p>

    <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; color: #333;">
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Organization</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${orgName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Plan / Subscription</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${planName || '-'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Amount Paid</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${amount.toFixed(2)} ${currency.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Payment Date</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${dateString}</td>
      </tr>
    </table>

    <p style="font-size: 14px; color: #555;">
      We appreciate your business and look forward to serving you. If you have any questions regarding this payment, please contact our support team at
      <a href="mailto:support@${process.env.APP_DOMAIN || 'example.com'}" style="color: #1E90FF;">support@${process.env.APP_DOMAIN || 'example.com'}</a>.
    </p>

    <p style="font-size: 12px; color: #888; text-align: center; margin-top: 30px;">
      &copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Our App'}. All rights reserved.
    </p>
  </div>
  `;

    await this.sendEmail(email, subject, body);
  }

  async sendSubscriptionExpiryReminder(
    email: string,
    details: {
      firstName?: string;
      orgName: string;
      plan: string;
      expiryDate: string; // e.g., "2025-09-17"
      amount?: number;
      currency?: string;
    },
  ): Promise<void> {
    const subject = 'Your Subscription is About to Expire';

    const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1E90FF; text-align: center; margin-bottom: 20px;">Subscription Renewal Reminder</h2>
      
      <p style="font-size: 15px; color: #000;">
        ${details.firstName ? `Hello ${details.firstName},<br/><br/>` : ''}
        Your subscription for <strong>${details.orgName}</strong> (${details.plan}) is set to renew on <strong>${details.expiryDate}</strong>.
      </p>

      ${
        details.amount
          ? `<p style="font-size: 15px; color: #000;">
              The upcoming charge will be <strong>${details.amount} ${details.currency?.toUpperCase() || 'GBP'}</strong>.
            </p>`
          : ''
      }

      <p style="font-size: 15px; color: #000;">
        Please ensure your payment method is up to date to avoid any interruption of service.
      </p>

      <p style="font-size: 13px; color: #000; margin-top: 20px; text-align: center;">
        Thank you for using <strong style="color: #1E90FF;">${process.env.APP_NAME || 'Our App'}</strong>!
      </p>
    </div>
  `;

    await this.sendEmail(email, subject, body);
  }

  // Create verification email template
  createVerificationEmailBody(
    verificationUrl: string,
    firstName?: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4A90E2; margin-bottom: 10px;">Email Verification</h1>
          <p style="color: #666; font-size: 16px;">Please verify your email address to complete your registration</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0;">
          ${firstName ? `<p style="font-size: 16px; margin-bottom: 15px;">Hello ${firstName},</p>` : ''}
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Thank you for registering with us! To complete your account setup and start using our services, 
            please click the button below to verify your email address.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #4A90E2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.5;">
            If the button doesn't work, you can copy and paste this link into your browser:
            <br>
            <a href="${verificationUrl}" style="color: #4A90E2; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 14px; color: #999; margin: 0;">
              This verification link will expire in 24 hours for security reasons.
              <br>
              If you didn't create an account with us, please ignore this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #999;">
            Best regards,<br>
            The ${process.env.APP_NAME || 'Our'} Team
          </p>
        </div>
      </div>
    `;
  }

  // Create welcome email template
  createWelcomeEmailBody(firstName?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin-bottom: 10px;">🎉 Welcome!</h1>
          <p style="color: #666; font-size: 16px;">Your email has been successfully verified</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0;">
          ${firstName ? `<p style="font-size: 16px; margin-bottom: 15px;">Hello ${firstName},</p>` : ''}
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Congratulations! Your email address has been successfully verified. 
            You can now access all features of your account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
              Start Using Your Account
            </a>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Here are some things you can do now:
          </p>
          
          <ul style="font-size: 14px; color: #666; line-height: 1.6;">
            <li>Create and manage events</li>
            <li>Generate content using AI</li>
            <li>Invite team members</li>
            <li>Access all premium features</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #999;">
            Welcome aboard!<br>
            The ${process.env.APP_NAME || 'Our'} Team
          </p>
        </div>
      </div>
    `;
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: body,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new InternalServerErrorException('Could not send email.'); // Handle error appropriately
    }
  }

  createEmailBody(
    contentType: string,
    body: string,
    attachment: string,
  ): string {
    const emailBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; border: 1px solid #ccc; border-radius: 5px;">
        <h2 style="color: #4A90E2;">New Content Created</h2>
        <img src="${attachment || 'https://placeholder.com/400x200'}" 
             alt="Content attachment" 
             style="max-width: 100%; height: auto; border-radius: 5px;"/>
        
        <p style="font-size: 18px; margin: 10px 0;">Here's the content:</p>
        <p style="font-size: 16px;"><strong>Content Type:</strong> ${contentType}</p>
        <p style="font-size: 16px;">${body}</p>
      </div>
    `;
    return emailBody;
  }
}
