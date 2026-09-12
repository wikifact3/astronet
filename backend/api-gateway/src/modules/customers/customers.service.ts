import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities/customer.entity';
import { Account } from '../../database/entities/account.entity';

export interface MeResponse {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  preferredLanguage: string;
  kycStatus: string;
  accounts: Array<{
    id: string;
    accountType: string;
    status: string;
    referralCode: string | null;
    parentAccountId: string | null;
  }>;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async getMe(customerId: string): Promise<MeResponse> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const accounts = await this.accountRepo.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });

    return {
      id: customer.id,
      phone: customer.phone,
      email: customer.email ?? null,
      fullName: customer.fullName,
      preferredLanguage: customer.preferredLanguage,
      kycStatus: customer.kycStatus,
      accounts: accounts.map((a) => ({
        id: a.id,
        accountType: a.accountType,
        status: a.status,
        referralCode: a.referralCode ?? null,
        parentAccountId: a.parentAccountId ?? null,
      })),
    };
  }
}
