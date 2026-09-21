import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    const requestId = req.id ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;

        // Nest's validation pipe returns { message: string[] , error, statusCode }
        if (Array.isArray(b.message)) {
          message = b.message.join('; ');
          code = 'VALIDATION_ERROR';
          details = b.message;
        } else if (typeof b.message === 'string') {
          message = b.message;
        }

        // Our own error envelopes from HttpException use { error: { code, message } }
        if (typeof b.error === 'object' && b.error !== null) {
          const e = b.error as Record<string, unknown>;
          if (typeof e.code === 'string') code = e.code;
          if (typeof e.message === 'string') message = e.message;
        }
      }

      if (code === 'INTERNAL_ERROR') {
        code = httpStatusToCode(status);
      }
    } else if (exception instanceof Error) {
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message;
    }

    // Structured log for every error
    const logPayload = {
      requestId,
      status,
      code,
      path: req.url,
      method: req.method,
      err: exception instanceof Error ? { message: exception.message, stack: exception.stack } : String(exception),
    };

    if (status >= 500) {
      this.logger.error(logPayload);
    } else {
      this.logger.warn(logPayload);
    }

    const body: ErrorEnvelope = {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    };

    res.status(status).json(body);
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'HTTP_' + status;
  }
}
