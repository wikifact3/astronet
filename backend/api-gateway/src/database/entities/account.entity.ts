import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Customer } from './customer.entity';
import { Subscription } from './subscription.entity';

export enum AccountStatus {
  LEAD = 'lead',
  KYC_PENDING = 'kyc_pending',
  KYC_REJECTED = 'kyc_rejected',
  INSTALLATION_SCHEDULED = 'installation_scheduled',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CHURNED = 'churned',
}

export enum AccountType {
  RETAIL = 'retail',
  ENTERPRISE = 'enterprise',
}

@Entity({ schema: 'powerlink_core', name: 'accounts' })
export class Account extends BaseEntity {
  @ManyToOne(() => Customer, customer => customer.accounts)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: Account;

  @Column({ name: 'parent_account_id', nullable: true })
  parentAccountId: string;

  @Column({ 
    name: 'account_type', 
    type: 'enum',
    enum: AccountType,
    default: AccountType.RETAIL 
  })
  accountType: AccountType;

  @Column({ 
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.LEAD 
  })
  status: AccountStatus;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress: object;

  @Column({ name: 'installation_address', type: 'jsonb', nullable: true })
  installationAddress: object;

  @Column({ name: 'gps_coordinates', type: 'jsonb', nullable: true })
  gpsCoordinates: object;

  @Column({ name: 'referral_code', length: 20, unique: true, nullable: true })
  referralCode: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'referred_by' })
  referredBy: Account;

  @Column({ name: 'referred_by', nullable: true })
  referredById: string;

  @OneToMany(() => Subscription, subscription => subscription.account)
  subscriptions: Subscription[];
}
