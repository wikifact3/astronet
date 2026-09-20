import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { SparrowSmsProvider } from './providers/sparrow.provider';
import { DevLoggerSmsProvider } from './providers/dev-logger.provider';
import { SmsLog } from '../../database/entities/sms-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SmsLog])],
  providers: [SmsService, SparrowSmsProvider, DevLoggerSmsProvider],
  exports: [SmsService],
})
export class SmsModule {}
