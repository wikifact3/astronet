import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'powerlink_core', name: 'idempotency_keys' })
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 80 })
  scope: string;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: object;

  @Column({ name: 'response_status', type: 'int' })
  responseStatus: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
