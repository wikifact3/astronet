import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum TicketMessageAuthorType {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  SYSTEM = 'system',
}

@Entity({ schema: 'powerlink_core', name: 'ticket_messages' })
@Index(['ticketId', 'createdAt'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'author_type', type: 'varchar', length: 20 })
  authorType: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments: object[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}