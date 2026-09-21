import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Normalise route: /v1/invoices/:id → /v1/invoices/:id
    // Nest stores the route pattern on req.route.path after matching.
    const start = process.hrtime.bigint();
    this.metrics.httpRequestsInFlight.inc();

    const finalise = () => {
      const durationSec =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;
      this.metrics.httpRequestsInFlight.dec();
      const routePattern =
        (req.route?.path as string | undefined) ??
        req.baseUrl ??
        req.url.split('?')[0];
      const labels = {
        method: req.method,
        route: routePattern,
        status: String(res.statusCode),
      };
      this.metrics.httpRequestDuration.observe(labels, durationSec);
      this.metrics.httpRequestTotal.inc(labels);
    };

    return next.handle().pipe(
      tap(() => finalise()),
      catchError((err) => {
        // Also count failed requests
        finalise();
        return throwError(() => err);
      }),
    );
  }
}
