import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OtpCode } from '../../database/entities/otp-code.entity';

export interface RateLimitContext {
  phone: string;
  ip: string | null;
}

/**
 * Rate limiting for OTP dispatch. Three windows, all sourced from the
 * otp_codes table (indexed on phone, ip_address, created_at):
 *
 *  - per-phone  — stops a single attacker hammering one number
 *  - per-ip     — stops a single host cycling through many numbers
 *  - global     — stops a distributed flood, protects SMS provider quota
 *
 * All counts use a rolling 1-hour window. Not atomic across concurrent
 * requests, but for OTP the practical rate is low enough that a small
 * overshoot on a burst is acceptable. When Redis is wired in Phase 2,
 * swap the internals behind the same `check()` signature.
 */
@Injectable()
export class OtpRateLimitService {
  private readonly logger = new Logger(OtpRateLimitService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    private readonly configService: ConfigService,
  ) {}

  async check(ctx: RateLimitContext): Promise<void> {
    const cfg = this.configService.get('app.otp.rateLimits');
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    // Run all three counts in parallel
    const [phoneCount, ipCount, globalCount] = await Promise.all([
      this.otpRepo
        .createQueryBuilder('o')
        .where('o.phone = :phone', { phone: ctx.phone })
        .andWhere('o.created_at >= :windowStart', { windowStart })
        .getCount(),

      ctx.ip
        ? this.otpRepo
            .createQueryBuilder('o')
            .where('o.ip_address = :ip', { ip: ctx.ip })
            .andWhere('o.created_at >= :windowStart', { windowStart })
            .getCount()
        : Promise.resolve(0),

      this.otpRepo
        .createQueryBuilder('o')
        .where('o.created_at >= :windowStart', { windowStart })
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
}
