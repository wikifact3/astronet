import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';
import { StaffUser } from './staff-user.entity';

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

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ 
    type: 'enum',
    enum: TicketCategory 
  })
  category: TicketCategory;

  @Column({ 
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN 
  })
  status: TicketStatus;

  @Column({ default: 'medium', length: 20 })
  priority: string;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => StaffUser, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: StaffUser;

  @Column({ name: 'assigned_to', nullable: true })
  assignedToId: string;

  @Column({ name: 'assigned_at', nullable: true })
  assignedAt: Date;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'reopened_count', default: 0 })
  reopenedCount: number;

  @Column({ name: 'reopen_deadline', nullable: true })
  reopenDeadline: Date;

  @Column({ name: 'customer_satisfaction_rating', nullable: true })
  customerSatisfactionRating: number;

  @Column({ length: 20, nullable: true })
  ward: string;
}
