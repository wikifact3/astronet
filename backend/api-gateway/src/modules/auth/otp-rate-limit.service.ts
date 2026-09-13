import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OtpRequestLog, OtpRequestOutcome } from '../../database/entities/otp-request-log.entity';

export interface RateLimitContext {
  phone: string;
  ip: string | null;
}

/**
 * Rate limiting for OTP dispatch. Every request — whether it results in an
 * SMS or not — is logged to otp_request_log, and the counters read from
 * that table. This closes the bypass where unregistered numbers could be
 * probed without consuming rate limit budget.
 *
 * Windows: rolling 1 hour, indexed by (phone, created_at) and (ip, created_at).
 */
@Injectable()
export class OtpRateLimitService {
  private readonly logger = new Logger(OtpRateLimitService.name);

  constructor(
    @InjectRepository(OtpRequestLog)
    private readonly logRepo: Repository<OtpRequestLog>,
    private readonly configService: ConfigService,
  ) {}

  async check(ctx: RateLimitContext): Promise<void> {
    const cfg = this.configService.get('app.otp.rateLimits');
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    const [phoneCount, ipCount, globalCount] = await Promise.all([
      this.logRepo
        .createQueryBuilder('l')
        .where('l.phone = :phone', { phone: ctx.phone })
        .andWhere('l.created_at >= :windowStart', { windowStart })
        .getCount(),

      ctx.ip
        ? this.logRepo
            .createQueryBuilder('l')
            .where('l.ip_address = :ip', { ip: ctx.ip })
            .andWhere('l.created_at >= :windowStart', { windowStart })
            .getCount()
        : Promise.resolve(0),

      this.logRepo
        .createQueryBuilder('l')
        .where('l.created_at >= :windowStart', { windowStart })
        .getCount(),
    ]);

    if (phoneCount >= cfg.perPhonePerHour) {
      this.logger.warn(
        `OTP phone limit hit: phone=${ctx.phone} count=${phoneCount}/${cfg.perPhonePerHour}`,
      );
      throw new HttpException(
        { error: { code: 'OTP_PHONE_LIMIT', message: 'Too many OTP requests for this number. Try again in an hour.' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (ipCount >= cfg.perIpPerHour) {
      this.logger.warn(
        `OTP ip limit hit: ip=${ctx.ip} count=${ipCount}/${cfg.perIpPerHour}`,
      );
      throw new HttpException(
        { error: { code: 'OTP_IP_LIMIT', message: 'Too many OTP requests from this network. Try again in an hour.' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (globalCount >= cfg.globalPerHour) {
      this.logger.error(
        `OTP global limit hit: count=${globalCount}/${cfg.globalPerHour}`,
      );
      throw new HttpException(
        { error: { code: 'OTP_GLOBAL_LIMIT', message: 'OTP service is temporarily rate-limited. Try again shortly.' } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Record the outcome of a request. Call this for every request that
   * passes `check()` — even ones that end in not_registered, so they count
   * against the limit.
   */
  async record(
    ctx: RateLimitContext,
    outcome: OtpRequestOutcome,
  ): Promise<void> {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          phone: ctx.phone,
          ipAddress: ctx.ip,
          outcome,
        }),
      );
    } catch (err) {
      // Never let logging failure break the request — just note it.
      this.logger.error(`Failed to record OTP request log: ${(err as Error).message}`);
    }
  }
}
