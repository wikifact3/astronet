import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { Invoice } from '../../../database/entities/invoice.entity';
import { Account } from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { Subscription } from '../../../database/entities/subscription.entity';
import { Plan } from '../../../database/entities/plan.entity';
import { Payment } from '../../../database/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice, Account, Customer, Subscription, Plan, Payment,
    ]),
  ],
  controllers: [AdminBillingController],
  providers: [AdminBillingService],
})
export class AdminBillingModule {}
