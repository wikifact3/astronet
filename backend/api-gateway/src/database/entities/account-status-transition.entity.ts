import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index,
} from 'typeorm';

@Entity({ schema: 'powerlink_core', name: 'account_status_transitions' })
@Index(['accountId', 'createdAt'])
export class AccountStatusTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'from_status', type: 'enum', enumName: 'account_status', nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'enum', enumName: 'account_status' })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, default: 'staff' })
  actorType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
