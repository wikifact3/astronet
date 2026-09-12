import {
  Injectable, UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, And } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'crypto';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { Customer } from '../../database/entities/customer.entity';
import { SmsService } from '../sms/sms.service';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepo: Repository<OtpCode>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
    private readonly sms: SmsService,
  ) {}

  async requestOtp(phone: string, ip?: string): Promise<{ expiresIn: number }> {
    const cfg = this.configService.get('app.otp');
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    const recentCount = await this.otpRepo.count({
      where: { phone, createdAt: MoreThan(windowStart) },
    });

    if (recentCount >= cfg.maxRequestsPerHour) {
      throw new BadRequestException(
        `Too many OTP requests. Try again in an hour.`,
      );
    }

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
        ipAddress: ip ?? null,
      }),
    );

    await this.sms.send(
      phone,
      `Your PowerLink verification code is ${code}. Valid for ${cfg.expiresInSeconds / 60} minutes.`,
    );

    return { expiresIn: cfg.expiresInSeconds };
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
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

    if (otp.attemptCount >= 5) {
      otp.consumedAt = new Date();
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('Too many attempts. Request a new OTP.');
    }

    if (!this.safeCompare(otp.code, code)) {
      otp.attemptCount += 1;
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('Invalid OTP');
    }

    otp.consumedAt = new Date();
    await this.otpRepo.save(otp);

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

    const tokens = await this.issueTokens(customer);

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

  async refresh(refreshToken: string): Promise<TokenPair> {
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

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const customer = await this.customerRepo.findOne({ where: { id: payload.sub } });
    if (!customer) {
      throw new UnauthorizedException('Customer no longer exists');
    }

    return this.issueTokens(customer);
  }

  private async issueTokens(customer: Customer): Promise<TokenPair> {
    const accessPayload: JwtPayload = {
      sub: customer.id,
      phone: customer.phone,
      typ: 'access',
    };
    const refreshPayload: RefreshPayload = {
      sub: customer.id,
      typ: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.configService.get<string>('app.jwt.secret'),
        expiresIn: this.configService.get<string>('app.jwt.expiresIn'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('app.jwt.refreshExpiresIn'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.audience'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateOtp(length: number): string {
    // crypto.randomInt is uniform; avoid Math.random
    const max = 10 ** length;
    return randomInt(0, max).toString().padStart(length, '0');
  }

  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
