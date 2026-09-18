import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { KycUploadController } from './kyc-upload.controller';
import { KycUploadService } from './kyc-upload.service';
import { KycUploadSession } from '../../../database/entities/kyc-upload-session.entity';
import { KycDocument } from '../../../database/entities/kyc-document.entity';
import { Account } from '../../../database/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycUploadSession, KycDocument, Account]),
    BullModule.registerQueue({ name: 'kyc' }),
  ],
  controllers: [KycUploadController],
  providers: [KycUploadService],
  exports: [KycUploadService],
})
export class KycUploadModule {}
