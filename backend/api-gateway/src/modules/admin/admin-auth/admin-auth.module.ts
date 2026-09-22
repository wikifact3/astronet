import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { StaffUser } from '../../../database/entities/staff-user.entity';
import { Role } from '../../../database/entities/role.entity';
import { RefreshToken } from '../../../database/entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffUser, Role, RefreshToken]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('app.jwt.expiresIn'),
          issuer: configService.get<string>('app.jwt.issuer'),
        },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy, RolesGuard],
  exports: [AdminAuthService, AdminJwtStrategy, RolesGuard],
})
export class AdminAuthModule {}
