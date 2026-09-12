import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  const allowed = [
    ...configService.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean),
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CODESPACE_NAME &&
      `https://${process.env.CODESPACE_NAME}-3000.app.github.dev`,
    process.env.CODESPACE_NAME &&
      `https://${process.env.CODESPACE_NAME}-3001.app.github.dev`,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('v1');

  const port = configService.get<number>('app.port', 8080);
  await app.listen(port);

  logger.log(`🚀 PowerLink API running on http://localhost:${port}/v1`);
  logger.log(`   CORS allowed: ${allowed.join(', ')}`);
}

bootstrap();