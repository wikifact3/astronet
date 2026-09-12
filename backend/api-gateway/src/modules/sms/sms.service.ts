import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendSmsResult {
  provider: string;
  messageId: string;
  delivered: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(phone: string, message: string): Promise<SendSmsResult> {
    const devMode = this.configService.get<boolean>('app.otp.devMode');

    if (devMode) {
      this.logger.log(`📱 [DEV SMS] to=${phone} body="${message}"`);
      return {
        provider: 'dev-logger',
        messageId: `dev-${Date.now()}`,
        delivered: true,
      };
    }

    // TODO Phase 2: integrate real SMS gateway (Sparrow SMS / Nexmo / Twilio).
    // The signature is stable; only the body of this method changes.
    throw new Error(
      'SMS provider not configured. Set SMS_PROVIDER_API_KEY and implement SmsService.send().',
    );
  }
}
