import {
  Injectable, Logger, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcrypt';
import { randomUUID } from 'crypto';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Role } from '../../database/entities/role.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AdminJwtPayload, AdminRefreshPayload } from './admin-auth.types';

export interface AdminLoginResult {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

interface SessionContext {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
    ctx: SessionContext,
  ): Promise<AdminLoginResult> {
    const cfg = this.configService.get('app.adminAuth');
    const staff = await this.staffRepo.findOne({ where: { email } });

    const invalid = () => new UnauthorizedException('Invalid email or password');

    if (!staff || !staff.isActive || !staff.passwordHash) {
      // Consume time to avoid timing oracle on existence
      await compare(
        password,
        '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid',
      );
      throw invalid();
    }

    if (staff.lockedUntil && staff.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account locked until ${staff.lockedUntil.toISOString()}`,
      );
    }

    const ok = await compare(password, staff.passwordHash);
    if (!ok) {
      const failed = staff.failedLoginCount + 1;
      const lock = failed >= cfg.maxFailedAttempts;
      staff.failedLoginCount = failed;
      staff.lockedUntil = lock
        ? new Date(Date.now() + cfg.lockoutMinutes * 60 * 1000)
        : null;
      await this.staffRepo.save(staff);
      this.logger.warn(
        `Admin login failed: email=${email} failed=${failed} locked=${lock}`,
      );
      throw invalid();
    }

    staff.failedLoginCount = 0;
    staff.lockedUntil = null;
    staff.lastLoginAt = new Date();
    await this.staffRepo.save(staff);

    const role = await this.roleRepo.findOne({ where: { id: staff.roleId } });
    const roleName = role?.name ?? 'UNKNOWN';

    const tokens = await this.issueTokenPair(staff, roleName, null, ctx);

    this.logger.log(`Admin login: email=${email} role=${roleName}`);

    return {
      ...tokens,
      staff: {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        role: roleName,
      },
    };
  }

  async refresh(
    refreshToken: string,
    ctx: SessionContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: AdminRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.adminAudience'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.typ !== 'admin-refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid token type');
    }

    const row = await this.refreshRepo.findOne({ where: { jti: payload.jti } });
    if (!row) throw new UnauthorizedException('Invalid refresh token');
    if (row.revokedAt) throw new UnauthorizedException('Refresh token has been revoked');

    const GRACE_MS = 10_000;
    if (row.usedAt) {
      const usedAgoMs = Date.now() - row.usedAt.getTime();
      if (usedAgoMs > GRACE_MS) {
        this.logger.error(
          `🚨 Admin refresh reuse: jti=${row.jti} family=${row.familyId}`,
        );
        await this.revokeFamily(row.familyId, 'reuse_detected');
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const staff = await this.staffRepo.findOne({ where: { id: row.customerId } });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException('Staff disabled');
      }
      const role = await this.roleRepo.findOne({ where: { id: staff.roleId } });
      const accessToken = await this.signAccess(staff, role?.name ?? 'UNKNOWN');
      return { accessToken, refreshToken: '' };
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const staff = await this.staffRepo.findOne({ where: { id: row.customerId } });
    if (!staff || !staff.isActive) {
      await this.revokeFamily(row.familyId, 'staff_disabled');
      throw new UnauthorizedException('Staff disabled');
    }

    row.usedAt = new Date();
    await this.refreshRepo.save(row);

    const role = await this.roleRepo.findOne({ where: { id: staff.roleId } });
    return this.issueTokenPair(staff, role?.name ?? 'UNKNOWN', row.familyId, ctx);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    let payload: AdminRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        issuer: this.configService.get<string>('app.jwt.issuer'),
        audience: this.configService.get<string>('app.jwt.adminAudience'),
      });
    } catch {
      return;
    }
    if (payload.typ !== 'admin-refresh' || !payload.jti) return;
    await this.refreshRepo.update(
      { jti: payload.jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokenPair(
    staff: StaffUser,
    roleName: string,
    familyId: string | null,
    ctx: SessionContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = randomUUID();
    const family = familyId ?? randomUUID();

    const refreshExpiresIn = this.configService.get<string>('app.jwt.refreshExpiresIn')!;
    const refreshExpiresAt = this.computeExpiry(refreshExpiresIn);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        jti,
        familyId: family,
        customerId: staff.id,
        subjectType: 'staff',
        expiresAt: refreshExpiresAt,
        usedAt: null,
        revokedAt: null,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      }),
    );

    const accessToken = await this.signAccess(staff, roleName);

    const refreshPayload: AdminRefreshPayload = {
      sub: staff.id,
      typ: 'admin-refresh',
      jti,
      familyId: family,
    };

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.configService.get<string>('app.jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
      issuer: this.configService.get<string>('app.jwt.issuer'),
      audience: this.configService.get<string>('app.jwt.adminAudience'),
    });

    return { accessToken, refreshToken };
  }

  private async signAccess(staff: StaffUser, roleName: string): Promise<string> {
    const payload: AdminJwtPayload = {
      sub: staff.id,
      email: staff.email,
      role: roleName,
      typ: 'admin-access',
    };

    return this.jwt.signAsync(payload, {
      secret: this.configService.get<string>('app.jwt.secret'),
      expiresIn: this.configService.get<string>('app.jwt.expiresIn'),
      issuer: this.configService.get<string>('app.jwt.issuer'),
      audience: this.configService.get<string>('app.jwt.adminAudience'),
    });
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
      `Revoked admin refresh family ${familyId} reason=${reason} affected=${result.affected ?? 0}`,
    );
  }

  private computeExpiry(duration: string): Date {
    const m = /^(\d+)([smhd])$/.exec(duration);
    if (!m) throw new Error(`Unsupported duration: ${duration}`);
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const ms =
      unit === 's' ? 1000
        : unit === 'm' ? 60_000
        : unit === 'h' ? 3_600_000
        : 86_400_000;
    return new Date(Date.now() + n * ms);
  }
}
