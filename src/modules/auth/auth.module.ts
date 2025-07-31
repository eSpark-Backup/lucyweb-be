import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { UserModule } from '../users/users.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '2h' }, // Default expiration
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [JwtModule], // Export JwtModule for use in other modules
})
export class AuthModule {}
