import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Account, AccountStatus,
} from '../../../database/entities/account.entity';
import { Customer } from '../../../database/entities/customer.entity';
import {
  AccountStatusTransition,
} from '../../../database/entities/account-status-transition.entity';
import { ListAccountsQueryDto } from './dto/list-accounts.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';

export interface AccountSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  accountType: string;
  status: AccountStatus;
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends AccountSummary {
  installationAddress: object | null;
  billingAddress: object | null;
  gpsCoordinates: object | null;
  kycStatus: string;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorId: string | null;
    actorType: string;
    createdAt: string;
  }>;
}

/**
 * Allowed transitions. Anything else is rejected with 400.
 * Matches the PRD §5.3 lifecycle:
 *   Lead → KYC Verification → Installation → Active → Suspended → Churned
 */
const ALLOWED_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  [AccountStatus.LEAD]: [
    AccountStatus.KYC_PENDING,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.KYC_PENDING]: [
    AccountStatus.KYC_REJECTED,
    AccountStatus.INSTALLATION_SCHEDULED,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.KYC_REJECTED]: [
    AccountStatus.KYC_PENDING,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.INSTALLATION_SCHEDULED]: [
    AccountStatus.ACTIVE,
    AccountStatus.KYC_PENDING,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.ACTIVE]: [
    AccountStatus.SUSPENDED,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.SUSPENDED]: [
    AccountStatus.ACTIVE,
    AccountStatus.CHURNED,
  ],
  [AccountStatus.CHURNED]: [],
};

@Injectable()
export class AdminCrmService {
  private readonly logger = new Logger(AdminCrmService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(AccountStatusTransition)
    private readonly transitionRepo: Repository<AccountStatusTransition>,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    query: ListAccountsQueryDto,
  ): Promise<{ accounts: AccountSummary[]; total: number }> {
    const qb = this.accountRepo
      .createQueryBuilder('a')
      .leftJoin(Customer, 'c', 'c.id = a.customer_id')
      .orderBy('a.updated_at', 'DESC')
      .limit(query.limit ?? 50)
      .offset((query.page ?? 0) * (query.limit ?? 50));

    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(c.full_name ILIKE :term OR c.phone ILIKE :term OR c.email ILIKE :term OR a.referral_code ILIKE :term)',
        { term },
      );
    }

    const [accounts, total] = await qb.getManyAndCount();
    const summaries = await Promise.all(accounts.map((a) => this.toSummary(a)));
    return { accounts: summaries, total };
  }

  async get(id: string): Promise<AccountDetail> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    const base = await this.toSummary(account);
    const customer = await this.customerRepo.findOne({ where: { id: account.customerId } });

    const transitions = await this.transitionRepo.find({
      where: { accountId: account.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      ...base,
      installationAddress: account.installationAddress,
      billingAddress: account.billingAddress,
      gpsCoordinates: account.gpsCoordinates,
      kycStatus: customer?.kycStatus ?? 'pending',
      transitions: transitions.map((t) => ({
        id: t.id,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        reason: t.reason,
        actorId: t.actorId,
        actorType: t.actorType,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async transition(
    id: string,
    staffId: string,
    dto: TransitionStatusDto,
  ): Promise<AccountDetail> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    const from = account.status;
    const to = dto.toStatus;

    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(', ') || '(none)'}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      account.status = to;
      await manager.save(account);

      await manager.save(
        manager.create(AccountStatusTransition, {
          accountId: account.id,
          fromStatus: from,
          toStatus: to,
          reason: dto.reason ?? null,
          actorId: staffId,
          actorType: 'staff',
        }),
      );

      // Side effects tied to specific transitions
      if (to === AccountStatus.ACTIVE) {
        const customer = await manager.findOne(Customer, {
          where: { id: account.customerId },
        });
        if (customer && customer.kycStatus !== 'approved') {
          // Do not block — log only. Installing before KYC approval is an
          // operational decision, not a data-integrity rule.
          this.logger.warn(
            `Activating account ${account.id} while customer ${customer.id} KYC is ${customer.kycStatus}`,
          );
        }
      }
    });

    this.logger.log(
      `Account ${account.id} ${from} → ${to} by staff=${staffId}${dto.reason ? ` reason="${dto.reason}"` : ''}`,
    );

    return this.get(id);
  }

  private async toSummary(a: Account): Promise<AccountSummary> {
    const customer = await this.customerRepo.findOne({ where: { id: a.customerId } });

    return {
      id: a.id,
      customerId: a.customerId,
      customerName: customer?.fullName ?? '(unknown)',
      customerPhone: customer?.phone ?? '',
      customerEmail: customer?.email ?? null,
      accountType: a.accountType,
      status: a.status,
      referralCode: a.referralCode,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
