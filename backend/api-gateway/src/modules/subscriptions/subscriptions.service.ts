import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../database/entities/subscription.entity';
import { Account } from '../../database/entities/account.entity';
import { Plan } from '../../database/entities/plan.entity';

export interface CurrentSubscriptionResponse {
  id: string;
  accountId: string;
  status: string;
  validityStart: string;
  validityEnd: string;
  daysRemaining: number;
  fupTier: string;
  fupExplanation: string;
  autoRenew: boolean;
  gracePeriod: {
    usedThisYear: number;
    maxPerYear: number;
    remaining: number;
  };
  plan: {
    id: string;
    name: string;
    speedMbps: number;
    basePrice: number;
    vatAmount: number;
    tscAmount: number;
    totalPrice: number;
    fupThresholdGb: number | null;
  };
}

export interface GracePeriodResult {
  newValidityEnd: string;
  gracePeriodUsedThisYear: number;
  remaining: number;
}

const FUP_EXPLANATIONS: Record<string, string> = {
  normal: 'Full speed. You are within your fair usage allowance.',
  throttle_l1: 'Reduced speed (Level 1). You have exceeded your fair usage allowance.',
  throttle_l2: 'Reduced speed (Level 2). Heavy usage detected. Speed restored next cycle.',
};

const GRACE_EXTENSION_DAYS = 2;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async getCurrentForCustomer(customerId: string): Promise<CurrentSubscriptionResponse> {
    const accounts = await this.accountRepo.find({ where: { customerId } });
    if (accounts.length === 0) {
      throw new NotFoundException('No account found for customer');
    }
    const accountIds = accounts.map((a) => a.id);

    const subscription = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.account_id IN (:...accountIds)', { accountIds })
      .orderBy(`CASE WHEN s.status = 'active' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('s.validity_end', 'DESC')
      .getOne();

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    const plan = await this.planRepo.findOne({ where: { id: subscription.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const today = new Date();
    const validityEnd = this.parseDate(subscription.validityEnd);
    const daysRemaining = Math.max(
      0,
      Math.ceil((validityEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const base = Number(plan.basePrice);
    const vatAmount = +(base * (Number(plan.vatRate) / 100)).toFixed(2);
    const tscAmount = +(base * (Number(plan.tscRate) / 100)).toFixed(2);
    const totalPrice = +(base + vatAmount + tscAmount).toFixed(2);

    const remaining = Math.max(
      0,
      subscription.maxGracePeriodPerYear - subscription.gracePeriodUsedThisYear,
    );

    return {
      id: subscription.id,
      accountId: subscription.accountId,
      status: subscription.status,
      validityStart: this.toDateString(subscription.validityStart),
      validityEnd: this.toDateString(subscription.validityEnd),
      daysRemaining,
      fupTier: subscription.fupTier,
      fupExplanation: FUP_EXPLANATIONS[subscription.fupTier] ?? '',
      autoRenew: subscription.autoRenew,
      gracePeriod: {
        usedThisYear: subscription.gracePeriodUsedThisYear,
        maxPerYear: subscription.maxGracePeriodPerYear,
        remaining,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        speedMbps: plan.speedMbps,
        basePrice: base,
        vatAmount,
        tscAmount,
        totalPrice,
        fupThresholdGb: plan.fupThresholdGb ?? null,
      },
    };
  }

  async useGracePeriod(
    customerId: string,
    subscriptionId: string,
  ): Promise<GracePeriodResult> {
    const sub = await this.subscriptionRepo.findOne({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    // Authorisation: subscription must belong to one of the customer's accounts
    const account = await this.accountRepo.findOne({ where: { id: sub.accountId } });
    if (!account || account.customerId !== customerId) {
      throw new NotFoundException('Subscription not found');
    }

    if (sub.gracePeriodUsedThisYear >= sub.maxGracePeriodPerYear) {
      throw new BadRequestException(
        `Promise to Pay has been used ${sub.gracePeriodUsedThisYear} of ${sub.maxGracePeriodPerYear} times this year.`,
      );
    }

    // Only extend if the sub is still within its current cycle (or just expired)
    const today = this.startOfDay(new Date());
    const currentEnd = this.parseDate(sub.validityEnd);
    const base = currentEnd > today ? currentEnd : today;
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + GRACE_EXTENSION_DAYS);

    sub.validityEnd = this.formatDate(newEnd) as unknown as Date;
    sub.gracePeriodUsedThisYear += 1;
    sub.status = 'active';

    await this.subscriptionRepo.save(sub);

    this.logger.log(
      `Grace period used for subscription ${sub.id}: +${GRACE_EXTENSION_DAYS} days → ${this.formatDate(newEnd)} (usage ${sub.gracePeriodUsedThisYear}/${sub.maxGracePeriodPerYear})`,
    );

    return {
      newValidityEnd: this.formatDate(newEnd),
      gracePeriodUsedThisYear: sub.gracePeriodUsedThisYear,
      remaining: Math.max(0, sub.maxGracePeriodPerYear - sub.gracePeriodUsedThisYear),
    };
  }

  // ------------------------------------------------------------------

  private parseDate(value: Date | string): Date {
    if (value instanceof Date) return this.startOfDay(value);
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toDateString(d: Date | string): string {
    if (typeof d === 'string') return d.slice(0, 10);
    return this.formatDate(d);
  }
}
