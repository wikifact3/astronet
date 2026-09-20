import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider, SendSmsParams, SendSmsResult } from './sms-provider.interface';

/**
 * Sparrow SMS provider. Sparrow is one of the leading bulk SMS providers
 * in Nepal, with broad coverage across Nepal Telecom and Ncell networks.
 *
 * API shape: POST to /v2/sms with token, from, to, text.
 * Response includes a message id we store for delivery tracking.
 */
@Injectable()
export class SparrowSmsProvider implements SmsProvider {
  readonly name = 'sparrow';
  private readonly logger = new Logger(SparrowSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const cfg = this.configService.get('sms.sparrow') as {
      token: string;
      from: string;
      baseUrl: string;
      timeoutMs: number;
    };

    if (!cfg.token) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: null,
        error: 'SPARROW_SMS_TOKEN is not configured',
      };
    }

    // Sparrow expects 10-digit local numbers without country code
    const phone = params.phone.replace(/^\+?977/, '');

    const url = `${cfg.baseUrl}/sms`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cfg.token,
          from: cfg.from,
          to: phone,
          text: params.message,
        }),
        signal: controller.signal,
      });

      const bodyText = await res.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        /* non-JSON response */
      }

      if (!res.ok) {
        this.logger.warn(
          `Sparrow rejected: status=${res.status} body=${bodyText.slice(0, 200)}`,
        );
        return {
          success: false,
          provider: this.name,
          providerMessageId: null,
          error: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
        };
      }

      // Sparrow returns { response_code: 200, message_id: "..." } on success
      const providerMessageId =
        typeof parsed.message_id === 'string' ? parsed.message_id : null;

      return {
        success: true,
        provider: this.name,
        providerMessageId,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Sparrow send failed: ${message}`);
      return {
        success: false,
        provider: this.name,
        providerMessageId: null,
        error: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
