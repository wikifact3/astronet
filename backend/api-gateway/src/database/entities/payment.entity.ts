import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Invoice } from './invoice.entity';

export enum PaymentProvider {
  ESEWA = 'esewa',
  KHALTI = 'khalti',
  FONEPAY = 'fonepay',
  CONNECTIPS = 'connectips',
}

export enum PaymentStatus {
  INITIATED = 'initiated',
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
  TIMEOUT = 'timeout',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

@Entity({ schema: 'powerlink_core', name: 'payments' })
export class Payment extends BaseEntity {
  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    enumName: 'payment_provider',
  })
  provider: PaymentProvider;

  @Column({ name: 'provider_txn_id', type: 'varchar', length: 100, unique: true, nullable: true })
  providerTxnId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.INITIATED,
  })
  status: PaymentStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, unique: true })
  idempotencyKey: string;

  @Column({ name: 'webhook_payload', type: 'jsonb', nullable: true })
  webhookPayload: object | null;

  @Column({ name: 'webhook_received_at', type: 'timestamptz', nullable: true })
  webhookReceivedAt: Date | null;

  @Column({ name: 'initiated_at', type: 'timestamptz', default: () => 'NOW()' })
  initiatedAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object | null;
}
