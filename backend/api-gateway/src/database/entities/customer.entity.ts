import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ schema: 'powerlink_core', name: 'customers' })
export class Customer extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'preferred_language', type: 'varchar', length: 10, default: 'en' })
  preferredLanguage: string;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    enumName: 'kyc_status',
    default: KycStatus.PENDING,
  })
  kycStatus: KycStatus;

  @Column({
    name: 'notification_preferences',
    type: 'jsonb',
    default: { sms: true, email: true, in_app: true },
  })
  notificationPreferences: object;
}
