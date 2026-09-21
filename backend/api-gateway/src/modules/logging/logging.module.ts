import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const level = configService.get<string>('logging.level', 'info');
        const pretty = configService.get<boolean>('logging.pretty', true);
        const redactPaths = configService.get<string[]>('logging.redactPaths', []);

        return {
          pinoHttp: {
            level,
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname,context',
                  },
                }
              : undefined,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              // Prefer incoming requestId (from proxy) else generate one
              const incoming =
                (req.headers['x-request-id'] as string | undefined) ??
                (req.headers['x-correlation-id'] as string | undefined);
              const id = incoming || randomUUID();
              res.setHeader('X-Request-Id', id);
              return id;
            },
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customSuccessMessage: (req, res) =>
              `${req.method} ${req.url} ${res.statusCode}`,
            customErrorMessage: (req, res, err) =>
              `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
            autoLogging: {
              ignore: (req) => req.url === '/v1/health' || req.url === '/v1/metrics',
            },
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                // no headers — they may carry sensitive data
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
              err: (err) => ({
                type: err.type,
                message: err.message,
                stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
              }),
            },
            redact: {
              paths: redactPaths,
              remove: false,
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
