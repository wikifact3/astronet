import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ schema: 'powerlink_core', name: 'audit_logs' })
@Index(['timestamp'])
@Index(['actorId', 'actorType'])
@Index(['resourceType', 'resourceId'])
export class AuditLog extends BaseEntity {
  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ name: 'actor_type', length: 20 })
  actorType: string;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ name: 'resource_id' })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp: Date;
}
