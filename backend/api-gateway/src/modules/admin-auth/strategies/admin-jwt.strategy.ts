import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffUser } from '../../../database/entities/staff-user.entity';
import { Role } from '../../../database/entities/role.entity';
import { AdminJwtPayload, AuthenticatedStaff } from '../admin-auth.types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwt.secret')!,
      issuer: configService.get<string>('app.jwt.issuer'),
      audience: configService.get<string>('app.jwt.adminAudience'),
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AuthenticatedStaff> {
    if (payload.typ !== 'admin-access') {
      throw new UnauthorizedException('Not an admin token');
    }
    const staff = await this.staffRepo.findOne({ where: { id: payload.sub } });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Staff account disabled');
    }
    const role = await this.roleRepo.findOne({ where: { id: staff.roleId } });
    return {
      id: staff.id,
      email: staff.email,
      role: role?.name ?? 'UNKNOWN',
    };
  }
}
