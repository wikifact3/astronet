import {
  Entity, Column, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Account } from './account.entity';

export enum KycUploadSessionStatus {
  OPEN = 'open',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Entity({ schema: 'powerlink_core', name: 'kyc_upload_sessions' })
@Index(['accountId', 'status'])
export class KycUploadSession extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
