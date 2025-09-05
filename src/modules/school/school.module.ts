/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
