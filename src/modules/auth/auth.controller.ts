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
import { ForgotPasswordDto } from 'src/common/dto/forgotPassword.dto';
import { ResetPasswordDto } from 'src/common/dto/resetPassword.dto';

@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('/sign-in')
  async login(@Body() userLoginDto: UserLoginDto) {
    // Return the full structured response from AuthService
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

  @Post('forgot-password')
  async forgotPassword(@Body() { email }: ForgotPasswordDto) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto.token, resetDto.newPassword);
  }
}
