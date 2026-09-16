import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminKycController } from './admin-kyc.controller';
import { AdminKycService } from './admin-kyc.service';
import { KycDocument } from '../../database/entities/kyc-document.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KycDocument, Customer, Account])],
  controllers: [AdminKycController],
  providers: [AdminKycService],
})
export class AdminKycModule {}
