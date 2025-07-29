import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as AWS from 'aws-sdk';

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
