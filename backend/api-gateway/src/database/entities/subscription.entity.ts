import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';
import { Plan } from './plan.entity';
import { Invoice } from './invoice.entity';

export enum FupTier {
  NORMAL = 'normal',
  THROTTLE_L1 = 'throttle_l1',
  THROTTLE_L2 = 'throttle_l2',
}

@Entity({ schema: 'powerlink_core', name: 'subscriptions' })
export class Subscription extends BaseEntity {
  @ManyToOne(() => Account, account => account.subscriptions)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ default: 'pending_activation' })
  status: string;

  @Column({ name: 'validity_start', type: 'date' })
  validityStart: Date;

  @Column({ name: 'validity_end', type: 'date' })
  validityEnd: Date;

  @Column({ 
    name: 'fup_tier', 
    type: 'enum',
    enum: FupTier,
    default: FupTier.NORMAL 
  })
  fupTier: FupTier;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @Column({ name: 'grace_period_used_this_year', default: 0 })
  gracePeriodUsedThisYear: number;

  @Column({ name: 'max_grace_period_per_year', default: 2 })
  maxGracePeriodPerYear: number;

  @Column({ name: 'billing_cycle', default: 'monthly', length: 10 })
  billingCycle: string;

  @OneToMany(() => Invoice, invoice => invoice.subscription)
  invoices: Invoice[];
}
