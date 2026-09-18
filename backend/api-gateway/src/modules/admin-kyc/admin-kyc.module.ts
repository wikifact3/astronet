import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminKycController } from './admin-kyc.controller';
import { AdminKycService } from './admin-kyc.service';
import { KycDocument } from '../../database/entities/kyc-document.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument, Customer, Account]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.secret'),
      }),
    }),
  ],
  controllers: [AdminKycController],
  providers: [AdminKycService],
})
export class AdminKycModule {}
