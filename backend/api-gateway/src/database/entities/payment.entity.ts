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
  @ManyToOne(() => Invoice, invoice => invoice.payments)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({ 
    type: 'enum',
    enum: PaymentProvider 
  })
  provider: PaymentProvider;

  @Column({ name: 'provider_txn_id', length: 100, unique: true, nullable: true })
  providerTxnId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ 
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED 
  })
  status: PaymentStatus;

  @Column({ name: 'idempotency_key', length: 100, unique: true })
  idempotencyKey: string;

  @Column({ name: 'webhook_payload', type: 'jsonb', nullable: true })
  webhookPayload: object;

  @Column({ name: 'webhook_received_at', nullable: true })
  webhookReceivedAt: Date;

  @Column({ name: 'initiated_at', type: 'timestamptz', default: () => 'NOW()' })
  initiatedAt: Date;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object;
}
