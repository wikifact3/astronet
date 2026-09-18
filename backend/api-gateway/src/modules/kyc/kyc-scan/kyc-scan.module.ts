import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { KycScanProcessor } from './kyc-scan.processor';
import { KycDocument } from '../../../database/entities/kyc-document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    BullModule.registerQueue({ name: 'kyc' }),
  ],
  providers: [KycScanProcessor],
})
export class KycScanProcessorModule {}
