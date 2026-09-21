import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf.service';
import { InvoiceSchedulerService } from './invoice-scheduler.service';
import { Invoice } from '../../database/entities/invoice.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Plan } from '../../database/entities/plan.entity';
import { Account } from '../../database/entities/account.entity';
import { Customer } from '../../database/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Subscription, Plan, Account, Customer]),
    ScheduleModule.forRoot(),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoiceSchedulerService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
