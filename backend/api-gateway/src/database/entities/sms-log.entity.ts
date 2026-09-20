import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index,
} from 'typeorm';

export enum SmsStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  FALLBACK = 'fallback',
}

export enum SmsCategory {
  OTP = 'otp',
  PAYMENT = 'payment',
  TICKET = 'ticket',
  KYC = 'kyc',
  LEAD = 'lead',
  BROADCAST = 'broadcast',
  OTHER = 'other',
}

@Entity({ schema: 'powerlink_core', name: 'sms_logs' })
@Index(['phone'])
@Index(['category', 'createdAt'])
export class SmsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({
    type: 'enum',
    enum: SmsCategory,
    enumName: 'sms_category',
  })
  category: SmsCategory;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: SmsStatus,
    enumName: 'sms_status',
    default: SmsStatus.PENDING,
  })
  status: SmsStatus;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 100, nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
