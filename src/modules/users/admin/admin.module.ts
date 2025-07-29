import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { EmailModule } from 'src/modules/email/email.module';

@Module({
  imports: [PrismaModule, JwtModule, EmailModule],
  providers: [AdminService],
  exports: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
