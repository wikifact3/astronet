import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { Customer } from '../../database/entities/customer.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpCode, Customer, RefreshToken,]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('app.jwt.expiresIn'),
          issuer: configService.get<string>('app.jwt.issuer'),
          audience: configService.get<string>('app.jwt.audience'),
        },
      }),
    }),
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService,  OtpRateLimitService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
