import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity({ schema: 'powerlink_core', name: 'refresh_tokens' })
@Index(['customerId'])
@Index(['expiresAt'])
@Index(['familyId'])
export class RefreshToken {
  // jti is the JWT ID — same value embedded in the signed token.
  @PrimaryColumn({ type: 'uuid' })
  jti: string;

  // All rotations of one logical session share a family id.
  // Reuse detection revokes the whole family at once.
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  // customer_id holds either a customer UUID or a staff UUID depending
  // on subject_type. This keeps one table for all refresh sessions.
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 20, default: 'customer' })
  subjectType: 'customer' | 'staff';

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  // Optional audit context
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;
}
