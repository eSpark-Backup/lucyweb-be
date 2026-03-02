/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JwtModule } from '@nestjs/jwt';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    // required for creating default events when a school is created
    // avoids a circular dependency since EventModule does not import
    // SchoolModule.
    EventModule,
  ],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
