import { Body, Controller, Post } from '@nestjs/common';
import { UserLoginDto } from 'src/common/dto/userLoginDto';
import { AuthService } from './auth.service';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/sign-in')
  async login(
    @Body() userLoginDto: UserLoginDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.userSignIn(userLoginDto);
  }
}
