import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { KycUploadSession } from './kyc-upload-session.entity';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum KycPipelineStatus {
  UPLOAD_PENDING = 'upload_pending',
  UPLOADED = 'uploaded',
  SCANNING = 'scanning',
  PROCESSING = 'processing',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  FAILED = 'failed',
  EXPIRED = 'expired',
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

  @Column({
    name: 'pipeline_status',
    type: 'enum',
    enum: KycPipelineStatus,
    enumName: 'kyc_pipeline_status',
    default: KycPipelineStatus.UPLOAD_PENDING,
  })
  pipelineStatus: KycPipelineStatus;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  @Column({ name: 'quarantine_key', type: 'varchar', length: 500, nullable: true })
  quarantineKey: string | null;

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64, nullable: true })
  checksumSha256: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'original_filename', type: 'varchar', length: 255, nullable: true })
  originalFilename: string | null;

  @Column({ name: 'scan_started_at', type: 'timestamptz', nullable: true })
  scanStartedAt: Date | null;

  @Column({ name: 'scan_completed_at', type: 'timestamptz', nullable: true })
  scanCompletedAt: Date | null;

  @Column({ name: 'scan_result', type: 'varchar', length: 50, nullable: true })
  scanResult: string | null;

  @Column({ name: 'processing_notes', type: 'text', nullable: true })
  processingNotes: string | null;

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

  @Column({ name: 'upload_session_id', type: 'uuid', nullable: true })
  uploadSessionId: string | null;

  @ManyToOne(() => KycUploadSession, { nullable: true })
  @JoinColumn({ name: 'upload_session_id' })
  uploadSession: KycUploadSession | null;
}
