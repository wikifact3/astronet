import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminTicketsController } from './admin-tickets.controller';
import { AdminTicketsService } from './admin-tickets.service';
import { Ticket } from '../../../database/entities/ticket.entity';
import { TicketMessage } from '../../../database/entities/ticket-message.entity';
import { Account } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { StaffUser } from '../../../database/entities/staff-user.entity';
import { Role } from '../../../database/entities/role.entity';
import { SmsModule } from '../../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketMessage, Account, Customer, StaffUser, Role]),
    SmsModule,
  ],
  controllers: [AdminTicketsController],
  providers: [AdminTicketsService],
})
export class AdminTicketsModule {}
