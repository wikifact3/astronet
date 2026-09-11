import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'notifications' })
@Index(['recipientId', 'recipientType'])
export class Notification extends BaseEntity {
  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ name: 'recipient_type', length: 20 })
  recipientType: string;

  @Column({ length: 20 })
  channel: string;

  @Column({ name: 'template_id', length: 50 })
  templateId: string;

  @Column({ type: 'jsonb' })
  content: object;

  @Column({ default: 'pending', length: 20 })
  status: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object;
}
