import {
  Injectable, UnauthorizedException, BadRequestException, Logger,
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
  // OTP
  // ------------------------------------------------------------------

  async requestOtp(
    phone: string,
    ctx: RequestContext,
  ): Promise<{ expiresIn: number }> {
    await this.rateLimit.check({ phone, ip: ctx.ip });

    const cfg = this.configService.get('app.otp');

    // Invalidate any outstanding unconsumed codes for this phone
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

    await this.sms.send(
      phone,
      `Your PowerLink verification code is ${code}. Valid for ${cfg.expiresInSeconds / 60} minutes.`,
    );

    return { expiresIn: cfg.expiresInSeconds };
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
      // Burn the record so subsequent attempts hit "expired or not found"
      await this.otpRepo.update({ id: otp.id }, { consumedAt: new Date() });
      throw new UnauthorizedException('Too many attempts. Request a new OTP.');
    }

    if (!this.safeCompare(otp.code, code)) {
      // Atomic increment — avoid read-modify-write race
      await this.otpRepo
        .createQueryBuilder()
        .update(OtpCode)
        .set({ attemptCount: () => 'attempt_count + 1' })
        .where('id = :id', { id: otp.id })
        .execute();
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.otpRepo.update({ id: otp.id }, { consumedAt: new Date() });

    // Find or create customer
    let customer = await this.customerRepo.findOne({ where: { phone } });
    let isNewUser = false;

    if (!customer) {
      customer = await this.customerRepo.save(
        this.customerRepo.create({
          phone,
          fullName: '',
          preferredLanguage: 'en',
          kycStatus: 'pending' as any,
        }),
      );
      isNewUser = true;
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
      isNewUser,
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
      // Unknown jti. Either forged or the row was already pruned.
      this.logger.warn(`Refresh: unknown jti=${payload.jti}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoked (logout, prior reuse-detection, or admin action)
    if (row.revokedAt) {
      this.logger.warn(
        `Refresh: revoked token reused jti=${row.jti} family=${row.familyId}`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Reuse detection: this token was already exchanged once
    if (row.usedAt) {
      this.logger.error(
        `🚨 Refresh token reuse detected: jti=${row.jti} family=${row.familyId} customer=${row.customerId}`,
      );
      await this.revokeFamily(row.familyId, 'reuse_detected');
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // Expired
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const customer = await this.customerRepo.findOne({ where: { id: row.customerId } });
    if (!customer) {
      await this.revokeFamily(row.familyId, 'customer_missing');
      throw new UnauthorizedException('Customer no longer exists');
    }

    // Mark current as used, then issue a new pair in the same family
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
      // Even an invalid/expired token is fine — nothing to revoke.
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
    // Supports: Ns, Nm, Nh, Nd
    const m = /^(\d+)([smhd])$/.exec(duration);
    if (!m) throw new Error(`Unsupported duration format: ${duration}`);
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const ms = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
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
