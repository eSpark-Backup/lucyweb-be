import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserLoginDto } from 'src/common/dto/userLoginDto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async userSignIn(
    loginDto: UserLoginDto,
  ): Promise<{ accessToken?: string; email_verified?: boolean }> {
    const { email, password } = loginDto;

    this.logger.log(`Login attempt for email: ${email}`);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true, // fetch user.role
        profile: { include: { role: true } }, // fetch profile.role
      },
    });

    if (!user) {
      this.logger.warn(`Login failed: No user found with email ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Incorrect password for email ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // ✅ Build a single payload so `role` is always present
    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.profile?.first_name,
      lastName: user.profile?.last_name,
      role:
        user.role?.name?.toLowerCase() ||
        user.profile?.role?.name?.toLowerCase(),
    };

    if (!user.email_verified) {
      this.logger.warn(`Email not verified for user: ${email}`);

      const verificationToken = this.emailService.generateVerificationToken();
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24);

      await this.prisma.user.update({
        where: { email },
        data: {
          email_verification_token: verificationToken,
          email_verification_expires: verificationExpires,
        },
      });

      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.profile?.first_name,
      );

      const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
      this.logger.log(`Verification email re-sent to: ${email}`);
      return { accessToken, email_verified: false };
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
    this.logger.log(`Login successful for email: ${email}`);

    return { accessToken, email_verified: true };
  }

  // Verify email method
  async verifyEmail(
    token: string,
  ): Promise<{ message: string; accessToken: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email_verification_token: token },
      include: {
        profile: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (
      user.email_verification_expires &&
      user.email_verification_expires < new Date()
    ) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.profile?.first_name,
    );

    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.profile?.first_name,
      lastName: user.profile?.last_name,
      role: user.profile?.role.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '2h',
    });

    return {
      message: 'Email verified successfully! Welcome to our platform.',
      accessToken,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.user.update({
      where: { email },
      data: {
        password_reset_token: token,
        password_reset_expires: expires,
      },
    });

    await this.sendPasswordResetEmail(email, token);
    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { password_reset_token: token },
    });

    if (
      !user ||
      !user.password_reset_expires ||
      user.password_reset_expires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });

    return { message: 'Password has been reset successfully' };
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;

    const subject = 'Reset Your Password';
    const body = this.createPasswordResetEmailBody(resetUrl, firstName);

    await this.emailService.sendEmail(email, subject, body);
  }

  private createPasswordResetEmailBody(
    resetUrl: string,
    firstName?: string,
  ): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #4A90E2; margin-bottom: 10px;">Reset Your Password</h1>
        <p style="color: #666; font-size: 16px;">We received a request to reset your password</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0;">
        ${
          firstName
            ? `<p style="font-size: 16px; margin-bottom: 15px;">Hi ${firstName},</p>`
            : ''
        }

        <p style="font-size: 16px; line-height: 1.6; color: #333;">
          Someone (hopefully you) requested a password reset for your account. Click the button below to reset your password.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #4A90E2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 14px; color: #666; line-height: 1.5;">
          If the button doesn’t work, you can also copy and paste this link into your browser:
          <br>
          <a href="${resetUrl}" style="color: #4A90E2; word-break: break-all;">${resetUrl}</a>
        </p>

        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 14px; color: #999; margin: 0;">
            This reset link will expire in 1 hour.
            <br>
            If you didn’t request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="font-size: 14px; color: #999;">
          Best regards,<br>
          The ${process.env.APP_NAME || 'EduPulse'} Team
        </p>
      </div>
    </div>
  `;
  }
}
