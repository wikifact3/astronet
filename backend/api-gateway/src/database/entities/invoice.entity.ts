import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';
import { Subscription } from './subscription.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  CREDIT_NOTE = 'credit_note',
}

export enum IrdSyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
  NOT_APPLICABLE = 'not_applicable',
}

@Entity({ schema: 'powerlink_core', name: 'invoices' })
export class Invoice extends BaseEntity {
  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Subscription)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 12, scale: 2 })
  vatAmount: number;

  @Column({ name: 'tsc_amount', type: 'decimal', precision: 12, scale: 2 })
  tscAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    enumName: 'invoice_status',
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({
    name: 'ird_sync_status',
    type: 'enum',
    enum: IrdSyncStatus,
    enumName: 'ird_sync_status',
    default: IrdSyncStatus.NOT_APPLICABLE,
  })
  irdSyncStatus: IrdSyncStatus;

  @Column({ name: 'ird_sync_attempted_at', type: 'timestamptz', nullable: true })
  irdSyncAttemptedAt: Date | null;

  @Column({ name: 'ird_sync_error', type: 'text', nullable: true })
  irdSyncError: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: Date | null;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'original_invoice_id' })
  originalInvoice: Invoice | null;

  @Column({ name: 'original_invoice_id', type: 'uuid', nullable: true })
  originalInvoiceId: string | null;
}
