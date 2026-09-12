import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Customer } from './customer.entity';

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
  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount: Account | null;

  @Column({ name: 'parent_account_id', type: 'uuid', nullable: true })
  parentAccountId: string | null;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: AccountType,
    enumName: 'account_type',
    default: AccountType.RETAIL,
  })
  accountType: AccountType;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    enumName: 'account_status',
    default: AccountStatus.LEAD,
  })
  status: AccountStatus;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress: object | null;

  @Column({ name: 'installation_address', type: 'jsonb', nullable: true })
  installationAddress: object | null;

  @Column({ name: 'gps_coordinates', type: 'jsonb', nullable: true })
  gpsCoordinates: object | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 20, unique: true, nullable: true })
  referralCode: string | null;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'referred_by' })
  referredBy: Account | null;

  @Column({ name: 'referred_by', type: 'uuid', nullable: true })
  referredById: string | null;
}
