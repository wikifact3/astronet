import {
  Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { Customer } from '../../database/entities/customer.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { SmsService } from '../sms/sms.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpRequestOutcome } from '../../database/entities/otp-request-log.entity';
import { JwtPayload, RefreshPayload } from './auth.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: {
    id: string;
    phone: string;
    fullName: string;
    preferredLanguage: string;
  };
  isNewUser: boolean;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface OtpRequestResult {
  status: 'sent';
  expiresIn: number;
}

export interface OtpNotRegisteredResult {
  status: 'not_registered';
  message: string;
  applyUrl: string;
  phone: string;
}

export type OtpRequestResponse = OtpRequestResult | OtpNotRegisteredResult;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
    private readonly sms: SmsService,
    private readonly rateLimit: OtpRateLimitService,
  ) {}

  // ------------------------------------------------------------------
  // OTP request
  // ------------------------------------------------------------------

  async requestOtp(
    phone: string,
    ctx: RequestContext,
  ): Promise<OtpRequestResponse> {
    // Every request hits the rate limiter first, then gets logged —
    // whether it results in an SMS or not. This is what closes the
    // "unregistered numbers bypass rate limits" hole.
    await this.rateLimit.check({ phone, ip: ctx.ip });

    const known = await this.customerRepo.exist({ where: { phone } });

    this.logger.log(
      `OTP request phone=${phone} ip=${ctx.ip ?? '-'} known_customer=${known}`,
    );

    if (!known) {
      await this.rateLimit.record(
        { phone, ip: ctx.ip },
        OtpRequestOutcome.NOT_REGISTERED,
      );
      const applyUrl = this.configService.get<string>('app.marketingApplyUrl');
      return {
        status: 'not_registered',
        message:
          'This number is not registered with PowerLink yet. Apply for a new connection to get started.',
        applyUrl: `${applyUrl}?phone=${encodeURIComponent(phone)}`,
        phone,
      };
    }

    const cfg = this.configService.get('app.otp');

    await this.otpRepo.update(
      { phone, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );

    const code = this.generateOtp(cfg.length);
    const expiresAt = new Date(Date.now() + cfg.expiresInSeconds * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        phone,
        code,
        expiresAt,
        consumedAt: null,
        attemptCount: 0,
        ipAddress: ctx.ip,
      }),
    );

    try {
      await this.sms.send(
        phone,
        `Your PowerLink verification code is ${code}. Valid for ${cfg.expiresInSeconds / 60} minutes.`,
      );
    } catch (err) {
      await this.rateLimit.record({ phone, ip: ctx.ip }, OtpRequestOutcome.SEND_FAILED);
      throw err;
    }

    await this.rateLimit.record({ phone, ip: ctx.ip }, OtpRequestOutcome.SENT);

    return { status: 'sent', expiresIn: cfg.expiresInSeconds };
  }

  async verifyOtp(
    phone: string,
    code: string,
    ctx: RequestContext,
  ): Promise<AuthResult> {
    const cfg = this.configService.get('app.otp');

    const otp = await this.otpRepo.findOne({
      where: {
        phone,
        consumedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    if (otp.attemptCount >= cfg.maxAttempts) {
      await this.otpRepo.update({ id: otp.id }, { consumedAt: new Date() });
      throw new UnauthorizedException('Too many attempts. Request a new OTP.');
    }

    if (!this.safeCompare(otp.code, code)) {
      await this.otpRepo
        .createQueryBuilder()
        .update(OtpCode)
        .set({ attemptCount: () => 'attempt_count + 1' })
        .where('id = :id', { id: otp.id })
        .execute();
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.otpRepo.update({ id: otp.id }, { consumedAt: new Date() });

    // Option C: an OTP can only exist for a known customer, so this
    // must resolve. If not, it means the customer was deleted between
    // request and verify — treat as unregistered.
    const customer = await this.customerRepo.findOne({ where: { phone } });
    if (!customer) {
      throw new UnauthorizedException(
        'This number is no longer registered. Please apply for a new connection.',
      );
    }

    const tokens = await this.issueTokenPair(customer, null, ctx);

    return {
      ...tokens,
      user: {
        id: customer.id,
        phone: customer.phone,
        fullName: customer.fullName,
        preferredLanguage: customer.preferredLanguage,
      },
      isNewUser: false,
    };
  }

  // ------------------------------------------------------------------
  // Refresh — rotation with reuse detection
  // ------------------------------------------------------------------

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh' || !payload.jti || !payload.familyId) {
      throw new UnauthorizedException('Invalid token type');
    }

    const row = await this.refreshRepo.findOne({ where: { jti: payload.jti } });
    if (!row) {
      this.logger.warn(`Refresh: unknown jti=${payload.jti}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt) {
      this.logger.warn(
        `Refresh: revoked token reused jti=${row.jti} family=${row.familyId}`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (row.usedAt) {
      this.logger.error(
        `🚨 Refresh token reuse detected: jti=${row.jti} family=${row.familyId} customer=${row.customerId}`,
      );
      await this.revokeFamily(row.familyId, 'reuse_detected');
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const customer = await this.customerRepo.findOne({ where: { id: row.customerId } });
    if (!customer) {
      await this.revokeFamily(row.familyId, 'customer_missing');
      throw new UnauthorizedException('Customer no longer exists');
    }

    row.usedAt = new Date();
    await this.refreshRepo.save(row);

    return this.issueTokenPair(customer, row.familyId, ctx);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      });
    } catch {
      return;
    }

    if (payload.typ !== 'refresh' || !payload.jti) return;

    await this.refreshRepo.update(
      { jti: payload.jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private async issueTokenPair(
    customer: Customer,
    familyId: string | null,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const jti = randomUUID();
    const family = familyId ?? randomUUID();

    const accessPayload: JwtPayload = {
      sub: customer.id,
      phone: customer.phone,
      typ: 'access',
    };
    const refreshPayload: RefreshPayload = {
      sub: customer.id,
      typ: 'refresh',
      jti,
      familyId: family,
    };

    const refreshExpiresIn = this.configService.get<string>('app.jwt.refreshExpiresIn')!;
    const refreshExpiresAt = this.computeExpiry(refreshExpiresIn);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        jti,
        familyId: family,
        customerId: customer.id,
        expiresAt: refreshExpiresAt,
        usedAt: null,
        revokedAt: null,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      }),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.configService.get<string>('app.jwt.secret'),
        expiresIn: this.configService.get<string>('app.jwt.expiresIn'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    const result = await this.refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();

    this.logger.warn(
      `Revoked refresh family ${familyId} reason=${reason} affected=${result.affected ?? 0}`,
    );
  }

  private computeExpiry(duration: string): Date {
    const m = /^(\d+)([smhd])$/.exec(duration);
    if (!m) throw new Error(`Unsupported duration format: ${duration}`);
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const ms =
      unit === 's' ? 1000
        : unit === 'm' ? 60_000
        : unit === 'h' ? 3_600_000
        : 86_400_000;
    return new Date(Date.now() + n * ms);
  }

  private generateOtp(length: number): string {
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }

  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
