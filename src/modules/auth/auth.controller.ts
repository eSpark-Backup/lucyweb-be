import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { UserLoginDto } from 'src/common/dto/userLoginDto';
import { AuthService } from './auth.service';
import { ResendVerificationDto } from 'src/common/dto/emailVerificationDto';
import { UserService } from '../users/user.service';

@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('/sign-in')
  async login(
    @Body() userLoginDto: UserLoginDto,
  ): Promise<{ accessToken?: string; email_verified?: boolean }> {
    return this.authService.userSignIn(userLoginDto);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<{ message: string; accessToken: string }> {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() { email }: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.userService.resendVerificationEmail(email);
  }

  @Get('verification-status')
  async checkVerificationStatus(
    @Query('email') email: string,
  ): Promise<{ verified: boolean }> {
    const user = await this.userService.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { verified: user.email_verified };
  }
}
