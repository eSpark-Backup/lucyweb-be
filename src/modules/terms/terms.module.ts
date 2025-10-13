import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TermsController],
  providers: [TermsService],
})
export class TermsModule {}
