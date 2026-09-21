import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter, Histogram, Gauge, Registry, collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  // ---------- HTTP ----------
  readonly httpRequestDuration = new Histogram({
    name: 'powerlink_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestTotal = new Counter({
    name: 'powerlink_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpRequestsInFlight = new Gauge({
    name: 'powerlink_http_requests_in_flight',
    help: 'HTTP requests currently being processed',
    registers: [this.registry],
  });

  // ---------- Business events ----------
  readonly otpRequestsTotal = new Counter({
    name: 'powerlink_otp_requests_total',
    help: 'OTP requests by outcome',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  readonly paymentsTotal = new Counter({
    name: 'powerlink_payments_total',
    help: 'Payments by provider and status',
    labelNames: ['provider', 'status'],
    registers: [this.registry],
  });

  readonly webhooksTotal = new Counter({
    name: 'powerlink_payment_webhooks_total',
    help: 'Webhook deliveries by provider and outcome',
    labelNames: ['provider', 'outcome'],
    registers: [this.registry],
  });

  readonly ticketsCreatedTotal = new Counter({
    name: 'powerlink_tickets_created_total',
    help: 'Tickets created',
    labelNames: ['category'],
    registers: [this.registry],
  });

  readonly kycUploadsTotal = new Counter({
    name: 'powerlink_kyc_uploads_total',
    help: 'KYC uploads by outcome',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  readonly smsSentTotal = new Counter({
    name: 'powerlink_sms_sent_total',
    help: 'SMS messages sent',
    labelNames: ['provider', 'category', 'status'],
    registers: [this.registry],
  });

  async onModuleInit(): Promise<void> {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
