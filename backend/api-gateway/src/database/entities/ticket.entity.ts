import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';

export enum TicketCategory {
  CONNECTIVITY = 'connectivity',
  BILLING = 'billing',
  HARDWARE = 'hardware',
  INSTALLATION = 'installation',
  GENERAL = 'general',
}

export enum TicketStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  FIELD_TECH_DISPATCHED = 'field_tech_dispatched',
  PENDING_CUSTOMER = 'pending_customer',
  RESOLVED = 'resolved',
  REOPENED = 'reopened',
  CLOSED = 'closed',
}

@Entity({ schema: 'powerlink_core', name: 'tickets' })
export class Ticket extends BaseEntity {
  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({
    type: 'enum',
    enum: TicketCategory,
    enumName: 'ticket_category',
  })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    enumName: 'ticket_status',
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  // assigned_to is stored as a scalar UUID. We deliberately do NOT declare
  // a @ManyToOne(() => StaffUser) here — that would force every module
  // registering Ticket to also register StaffUser, which drags unrelated
  // entities into the customer module. The admin portal, when it needs the
  // assignee, loads StaffUser by ID in its own scope.
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'reopened_count', type: 'int', default: 0 })
  reopenedCount: number;

  @Column({ name: 'reopen_deadline', type: 'timestamptz', nullable: true })
  reopenDeadline: Date | null;

  @Column({ name: 'customer_satisfaction_rating', type: 'int', nullable: true })
  customerSatisfactionRating: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ward: string | null;
}
