import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const globalPrefix = process.env.APP_VERSION ?? 'dev/api/v1';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);

  // Debug registered routes
  const server = app.getHttpAdapter();
  const routes = server
    .getInstance()
    ._router?.stack.filter((layer: any) => layer.route)
    .map((layer: any) => {
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      return `${method} ${layer.route.path}`;
    });
  console.log('Registered routes:', routes);
}

bootstrap();
