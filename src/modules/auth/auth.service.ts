import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserLoginDto } from 'src/common/dto/userLoginDto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService, // Inject the JwtService
  ) {}

  async userSignIn(loginDto: UserLoginDto): Promise<{ accessToken: string }> {
    const { email, password } = loginDto;

    // Find the user along with their profile information
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: {
          include: { role: true }, // Fetch the role through the profile
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    // TODO: Need to implement refresh token in the future
    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.profile?.first_name,
      lastName: user.profile?.last_name,
      role: user.profile?.role.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '2h', // Token expiration time
    });

    return { accessToken };
  }
}
