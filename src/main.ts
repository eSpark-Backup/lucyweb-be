import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  const globalPrefix = process.env.APP_VERSION ?? 'dev/api/v1';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Start application
  await app.listen(process.env.PORT ?? 3000);

  // Log all registered routes
  const server = app.getHttpAdapter();
  const routes = server
    .getInstance()
    ._router?.stack?.filter((layer: { route: any }) => layer.route)
    ?.map(
      (layer: { route: { methods: object; path: any } }) =>
        `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`,
    );
  console.log('Registered routes:', routes);
}
bootstrap();
