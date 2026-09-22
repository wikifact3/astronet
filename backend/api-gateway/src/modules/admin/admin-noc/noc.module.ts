import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NocController } from './noc.controller';
import { NocService } from './noc.service';
import { Ticket } from '../../../database/entities/ticket.entity';
import { Account } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { StaffUser } from '../../../database/entities/staff-user.entity';
import { Role } from '../../../database/entities/role.entity';
import { SmsModule } from '../../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Account, Customer, StaffUser, Role]),
    SmsModule,
  ],
  controllers: [NocController],
  providers: [NocService],
})
export class NocModule {}
