import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';
import { Subscription } from './subscription.entity';
import { Payment } from './payment.entity';

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

  @Column({ name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Subscription, subscription => subscription.invoices)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @Column({ name: 'invoice_number', unique: true, length: 50 })
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
    default: InvoiceStatus.DRAFT 
  })
  status: InvoiceStatus;

  @Column({ 
    name: 'ird_sync_status', 
    type: 'enum',
    enum: IrdSyncStatus,
    default: IrdSyncStatus.NOT_APPLICABLE 
  })
  irdSyncStatus: IrdSyncStatus;

  @Column({ name: 'ird_sync_attempted_at', nullable: true })
  irdSyncAttemptedAt: Date;

  @Column({ name: 'ird_sync_error', type: 'text', nullable: true })
  irdSyncError: string;

  @Column({ name: 'pdf_url', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'paid_at', nullable: true })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'original_invoice_id' })
  originalInvoice: Invoice;

  @Column({ name: 'original_invoice_id', nullable: true })
  originalInvoiceId: string;

  @OneToMany(() => Payment, payment => payment.invoice)
  payments: Payment[];
}
