import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Trust proxy must be set BEFORE any middleware that reads req.ip.
  // Without this, X-Forwarded-For can be spoofed by the client.
  const trustProxy = configService.get('app.trustProxy');
  app.set('trust proxy', trustProxy);
  logger.log(`trust proxy = ${JSON.stringify(trustProxy)}`);

     // CSP is disabled: the API serves JSON plus one HTML page (stub checkout)
  // that posts cross-path forms. Helmet's default form-action 'self' would
  // break that. We will not need a general CSP until the admin portal ships
  // real HTML from this origin. The customer-facing pages are served by
  // Next.js, which handles its own headers.
  app.use(helmet({
    contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false
}));
  app.use(compression());
  app.use(cookieParser());

  const allowed = [
    ...configService.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean),
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:8080',
    process.env.CODESPACE_NAME &&
      `https://${process.env.CODESPACE_NAME}-3000.app.github.dev`,
    process.env.CODESPACE_NAME &&
      `https://${process.env.CODESPACE_NAME}-3001.app.github.dev`,
    process.env.CODESPACE_NAME &&
      `https://${process.env.CODESPACE_NAME}-3002.app.github.dev`,
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
  logger.log(`   API_PUBLIC_BASE_URL:    ${configService.get('payment.apiPublicBaseUrl')}`);
  logger.log(`   PORTAL_PUBLIC_BASE_URL: ${configService.get('payment.portalPublicBaseUrl')}`);
  logger.log(`   PORTAL_PUBLIC_BASE_URL env: ${process.env.PORTAL_PUBLIC_BASE_URL ?? '(unset)'}`);
  logger.log(`   PORTAL_PUBLIC_BASE_URL cfg: ${configService.get('payment.portalPublicBaseUrl')}`);
  logger.log(`   STUB_CHECKOUT_BASE_URL:    ${configService.get('payment.stub.checkoutBaseUrl')}`);
}

bootstrap();