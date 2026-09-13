import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

export enum OtpRequestOutcome {
  SENT = 'sent',
  NOT_REGISTERED = 'not_registered',
  RATE_LIMITED = 'rate_limited',
  SEND_FAILED = 'send_failed',
}

@Entity({ schema: 'powerlink_core', name: 'otp_request_log' })
@Index(['phone', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
@Index(['createdAt'])
export class OtpRequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({
    type: 'enum',
    enum: OtpRequestOutcome,
    enumName: 'otp_request_outcome',
  })
  outcome: OtpRequestOutcome;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
