// src/modules/trust/trust.module.ts
import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UserModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, JwtModule, UserModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
