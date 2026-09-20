import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StubCheckoutController } from './stub-checkout.controller';
import { StubPaymentProvider } from './providers/stub.provider';
import { Payment } from '../../database/entities/payment.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { Account } from '../../database/entities/account.entity';
import { Customer } from '../../database/entities/customer.entity';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Invoice, Subscription, Account, Customer]),
    IdempotencyModule,
    SmsModule,
  ],
  controllers: [PaymentsController, StubCheckoutController],
  providers: [PaymentsService, StubPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
