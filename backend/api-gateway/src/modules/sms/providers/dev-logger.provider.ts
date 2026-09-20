import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SendSmsParams, SendSmsResult } from './sms-provider.interface';

/**
 * Development provider. Logs messages to the console and reports success.
 * Used when SMS_PROVIDER=dev-logger or when no real credentials are set.
 */
@Injectable()
export class DevLoggerSmsProvider implements SmsProvider {
  readonly name = 'dev-logger';
  private readonly logger = new Logger('SmsService');

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    this.logger.log(`📱 [DEV SMS] to=${params.phone} body="${params.message}"`);
    return {
      success: true,
      provider: this.name,
      providerMessageId: `dev-${Date.now()}`,
      error: null,
    };
  }
}
