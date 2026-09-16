import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ schema: 'powerlink_core', name: 'kyc_documents' })
export class KycDocument extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: string;

  @Column({ name: 'encrypted_file_ref', type: 'varchar', length: 500 })
  encryptedFileRef: string;

  @Column({ name: 'encrypted_national_id', type: 'varchar', length: 500, nullable: true })
  encryptedNationalId: string | null;

  @Column({
    type: 'enum',
    enum: KycStatus,
    enumName: 'kyc_status',
    default: KycStatus.PENDING,
  })
  status: KycStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'review_reason_code', type: 'varchar', length: 50, nullable: true })
  reviewReasonCode: string | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: Date | null;
}
