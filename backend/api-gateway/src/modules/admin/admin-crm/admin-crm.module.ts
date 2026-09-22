import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCrmController } from './admin-crm.controller';
import { AdminCrmService } from './admin-crm.service';
import { Account } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { AccountStatusTransition } from '../../../database/entities/account-status-transition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Customer, AccountStatusTransition])],
  controllers: [AdminCrmController],
  providers: [AdminCrmService],
})
export class AdminCrmModule {}
