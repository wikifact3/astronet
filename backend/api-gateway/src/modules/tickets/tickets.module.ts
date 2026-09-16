import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from '../../database/entities/ticket.entity';
import { TicketMessage } from '../../database/entities/ticket-message.entity';
import { Account } from '../../database/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMessage, Account])],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
