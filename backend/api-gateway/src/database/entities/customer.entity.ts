import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ schema: 'powerlink_core', name: 'customers' })
export class Customer extends BaseEntity {
  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ nullable: true, unique: true, length: 255 })
  email: string;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ name: 'preferred_language', default: 'en', length: 10 })
  preferredLanguage: string;

  @Column({ 
    name: 'kyc_status', 
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING 
  })
  kycStatus: KycStatus;

  @Column({ 
    name: 'notification_preferences', 
    type: 'jsonb',
    default: { sms: true, email: true, in_app: true }
  })
  notificationPreferences: object;

  @OneToMany(() => Account, account => account.customer)
  accounts: Account[];
}
