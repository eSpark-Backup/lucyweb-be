import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { RolesGuard } from './common/guard/roles.guard';
import { JwtService } from '@nestjs/jwt';

dotenv.config();

async function bootstrap() {
  const globalPrefix = process.env.APP_VERSION ?? 'dev/api/v1';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const reflector = app.get(Reflector);
  const jwtService = app.get(JwtService);

  // Apply RolesGuard globally
  app.useGlobalGuards(new RolesGuard(reflector, jwtService));

  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
