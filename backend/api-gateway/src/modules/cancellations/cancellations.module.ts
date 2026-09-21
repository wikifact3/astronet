import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationsController } from './cancellations.controller';
import { CancellationsService } from './cancellations.service';
import { CancellationRequest } from '../../database/entities/cancellation-request.entity';
import { Account } from '../../database/entities/account.entity';
import { Subscription } from '../../database/entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CancellationRequest, Account, Subscription])],
  controllers: [CancellationsController],
  providers: [CancellationsService],
})
export class CancellationsModule {}
