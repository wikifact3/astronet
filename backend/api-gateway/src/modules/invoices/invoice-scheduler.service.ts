import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../database/entities/subscription.entity';
import { Account, AccountStatus } from '../../database/entities/account.entity';
import { InvoicesService } from './invoices.service';

/**
 * Generates an invoice for every active subscription whose current cycle
 * is within 3 days of expiry. Runs once per day at 01:00 local time.
 *
 * Idempotent: generateCurrentForCustomer returns the existing issued
 * invoice rather than creating a duplicate. The result's `created` flag
 * distinguishes "made a new invoice" from "found one already issued" —
 * the scheduler counts those separately so the log is meaningful.
 */
@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    private readonly invoices: InvoicesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateUpcomingInvoices(): Promise<void> {
    this.logger.log('Running daily invoice generation...');

    const lookaheadDays = 3;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + lookaheadDays);

    const subs = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: 'active' })
      .andWhere('s.validity_end <= :threshold', { threshold })
      .getMany();

    let created = 0;
    let existing = 0;
    let skipped = 0;

    for (const sub of subs) {
      try {
        const account = await this.accountRepo.findOne({ where: { id: sub.accountId } });
        if (!account || account.status !== AccountStatus.ACTIVE) {
          skipped += 1;
          continue;
        }

        const result = await this.invoices.generateCurrentForCustomer(
          account.customerId,
        );

        if (result.created) {
          created += 1;
        } else {
          existing += 1;
        }
      } catch (err) {
        this.logger.error(
          `Invoice generation failed for subscription ${sub.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Invoice generation complete: created=${created} existing=${existing} skipped=${skipped}`,
    );
  }
}
