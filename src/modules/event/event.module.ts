// src/modules/event/event.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, JwtModule, StorageModule, EmailModule],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
