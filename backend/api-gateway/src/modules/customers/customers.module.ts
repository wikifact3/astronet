import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Account])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
