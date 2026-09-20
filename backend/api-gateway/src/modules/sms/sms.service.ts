import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  SmsLog, SmsStatus, SmsCategory,
} from '../../database/entities/sms-log.entity';
import { SmsProvider, SendSmsResult } from './providers/sms-provider.interface';
import { SparrowSmsProvider } from './providers/sparrow.provider';
import { DevLoggerSmsProvider } from './providers/dev-logger.provider';

export interface SmsSendOptions {
  category: SmsCategory;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;
  private readonly fallback: DevLoggerSmsProvider;

  constructor(
    @InjectRepository(SmsLog)
    private readonly logRepo: Repository<SmsLog>,
    private readonly configService: ConfigService,
    private readonly sparrow: SparrowSmsProvider,
    devLogger: DevLoggerSmsProvider,
  ) {
    const providerName = this.configService.get<string>('sms.provider', 'dev-logger');
    this.fallback = devLogger;
    this.provider = providerName === 'sparrow' ? this.sparrow : devLogger;
    this.logger.log(`SMS provider: ${this.provider.name}`);
  }

  /**
   * Legacy signature used by AuthService for OTP. Kept for compatibility.
   */
  async send(phone: string, message: string): Promise<SendSmsResult> {
    return this.dispatch(phone, message, SmsCategory.OTP);
  }

  /**
   * Send an SMS with a category. Persists a log row and falls back to the
   * dev logger if the real provider fails and fallback is enabled.
   */
  async dispatch(
    phone: string,
    message: string,
    category: SmsCategory,
  ): Promise<SendSmsResult> {
    // Normalise Nepali numbers to 10 digits
    const cleanPhone = phone.replace(/^\+?977/, '').replace(/\D/g, '').slice(-10);

    const log = this.logRepo.create({
      phone: cleanPhone,
      category,
      message,
      status: SmsStatus.PENDING,
      provider: this.provider.name,
    });
    const saved = await this.logRepo.save(log);

    let result = await this.provider.send({
      phone: cleanPhone,
      message,
      category,
    });

    // Fallback: if real provider failed and fallback is on, log via dev logger
    // so the message isn't lost. We record this distinctly.
    const fallbackOn = this.configService.get<boolean>('sms.fallbackToLogger', true);
    if (!result.success && this.provider.name !== 'dev-logger' && fallbackOn) {
      this.logger.warn(
        `Provider ${this.provider.name} failed (${result.error}); falling back to logger`,
      );
      const fallbackResult = await this.fallback.send({
        phone: cleanPhone,
        message,
        category,
      });
      await this.logRepo.update(
        { id: saved.id },
        {
          status: SmsStatus.FALLBACK,
          provider: `${this.provider.name}→${this.fallback.name}`,
          error: result.error,
          providerMessageId: fallbackResult.providerMessageId,
        },
      );
      return fallbackResult;
    }

    await this.logRepo.update(
      { id: saved.id },
      {
        status: result.success ? SmsStatus.SENT : SmsStatus.FAILED,
        providerMessageId: result.providerMessageId,
        error: result.error,
      },
    );

    return result;
  }
}
