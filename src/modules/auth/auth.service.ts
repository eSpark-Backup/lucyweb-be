import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { UserLoginDto } from 'src/common/dto/userLoginDto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

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
        profile: {
          include: { role: true },
        },
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

      this.logger.log(`Verification email re-sent to: ${email}`);
      return { email_verified: false };
    }

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

    this.logger.log(`Login successful for email: ${email}`);

    return { accessToken, email_verified: user.email_verified };
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
}
