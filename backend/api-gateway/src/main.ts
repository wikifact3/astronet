import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
     bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

 // Route all Nest logs through pino
  app.useLogger(app.get(PinoLogger));
  const trustProxy = configService.get('app.trustProxy');
  app.set('trust proxy', trustProxy);
  logger.log(`trust proxy = ${JSON.stringify(trustProxy)}`);

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
app.useGlobalFilters(new AllExceptionsFilter()); 
  app.setGlobalPrefix('v1');

  const port = configService.get<number>('app.port', 8080);
  await app.listen(port);

  logger.log(`🚀 PowerLink API running on http://localhost:${port}/v1`);
  logger.log(`   CORS allowed: ${allowed.join(', ')}`);
logger.log(`   Logging level: ${configService.get('logging.level')}`);
}
bootstrap();