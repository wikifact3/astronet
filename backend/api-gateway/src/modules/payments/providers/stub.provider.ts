import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import {
  InitiateParams,
  InitiateResult,
  PaymentProvider,
  WebhookEvent,
  WebhookVerifyInput,
} from './payment-provider.interface';

/**
 * Local stub provider that emulates the redirect-and-webhook shape of
 * eSewa and Khalti. Used in dev to exercise the full server flow without
 * real merchant credentials. The real providers will implement the same
 * interface when credentials arrive.
 *
 * Shape of the flow:
 *   1. Server calls initiate() -> gets a redirectUrl pointing at
 *      /v1/payments/stub-checkout?token=...
 *   2. User's browser lands on that page (see StubCheckoutController),
 *      clicks "Approve" or "Decline"
 *   3. That page POSTs to /v1/payments/stub/webhook with an HMAC signature
 *   4. Server verifies the signature, marks the payment, redirects the
 *      user back to the portal returnUrl
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub' as const;
  private readonly logger = new Logger(StubPaymentProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async initiate(params: InitiateParams): Promise<InitiateResult> {
    const base = this.configService.get<string>('payment.stub.checkoutBaseUrl')!;
    const token = Buffer.from(
      JSON.stringify({
        paymentId: params.paymentId,
        amount: params.amount,
        invoiceNumber: params.invoiceNumber,
        returnUrl: params.returnUrl,
        webhookUrl: params.webhookUrl,
      }),
    ).toString('base64url');

    const url = new URL(base);
    url.searchParams.set('token', token);

    return {
      redirectUrl: url.toString(),
      providerTxnId: null, // stub generates its txn id at webhook time
    };
  }

  async verifyWebhook(input: WebhookVerifyInput): Promise<WebhookEvent> {
    const secret = this.configService.get<string>('payment.stub.webhookSecret')!;
    const signature = input.signature;
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret)
      .update(input.rawBody)
      .digest('hex');

    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      this.logger.warn('Stub webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON');
    }

    const providerTxnId =
      typeof payload.providerTxnId === 'string' && payload.providerTxnId.length > 0
        ? payload.providerTxnId
        : `STUB-${randomUUID()}`;

    const statusRaw = String(payload.status || '').toLowerCase();
    const status: WebhookEvent['status'] =
      statusRaw === 'success' || statusRaw === 'confirmed'
        ? 'success'
        : statusRaw === 'pending'
          ? 'pending'
          : 'failure';

    const amount =
      typeof payload.amount === 'number' ? payload.amount : null;

    return {
      providerTxnId,
      status,
      amount,
      rawPayload: payload as Record<string, unknown>,
    };
  }
}
