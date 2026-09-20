import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminLeadsController } from './admin-leads.controller';
import { AdminLeadsService } from './admin-leads.service';
import { Lead } from '../../database/entities/lead.entity';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lead]), LeadsModule],
  controllers: [AdminLeadsController],
  providers: [AdminLeadsService],
})
export class AdminLeadsModule {}
