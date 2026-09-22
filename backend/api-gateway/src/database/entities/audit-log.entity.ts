import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'audit_logs' })
@Index(['timestamp'])
@Index(['actorId', 'actorType'])
@Index(['resourceType', 'resourceId'])
export class AuditLog extends BaseEntity {
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'actor_type', type: 'varchar', length: 20 })
  actorType: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp: Date;
}
