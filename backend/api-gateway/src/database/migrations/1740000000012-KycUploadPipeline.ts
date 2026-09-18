import { MigrationInterface, QueryRunner } from 'typeorm';

export class KycUploadPipeline1740000000012 implements MigrationInterface {
  name = 'KycUploadPipeline1740000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- 1. Extend kyc_documents with pipeline columns ----------
    await queryRunner.query(`
      ALTER TABLE powerlink_core.kyc_documents
        ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500),
        ADD COLUMN IF NOT EXISTS quarantine_key VARCHAR(500),
        ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64),
        ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
        ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
        ADD COLUMN IF NOT EXISTS scan_started_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS scan_completed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS scan_result VARCHAR(50),
        ADD COLUMN IF NOT EXISTS processing_notes TEXT
    `);

    // ---------- 2. New status enum with the 8 pipeline states ----------
    await queryRunner.query(`
      CREATE TYPE powerlink_core.kyc_pipeline_status AS ENUM (
        'upload_pending',
        'uploaded',
        'scanning',
        'processing',
        'verified',
        'rejected',
        'failed',
        'expired'
      )
    `);

    // Add the new column alongside the old one
    await queryRunner.query(`
      ALTER TABLE powerlink_core.kyc_documents
        ADD COLUMN pipeline_status powerlink_core.kyc_pipeline_status
          NOT NULL DEFAULT 'upload_pending'
    `);

    // Map existing rows. We preserve the old semantic meaning where possible.
    await queryRunner.query(`
      UPDATE powerlink_core.kyc_documents
      SET pipeline_status = CASE
        WHEN status = 'approved' THEN 'verified'::powerlink_core.kyc_pipeline_status
        WHEN status = 'rejected' THEN 'rejected'::powerlink_core.kyc_pipeline_status
        ELSE 'uploaded'::powerlink_core.kyc_pipeline_status
      END
    `);

    // ---------- 3. Upload sessions table ----------
    await queryRunner.query(`
      CREATE TABLE powerlink_core.kyc_upload_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES powerlink_core.accounts(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_kyc_sessions_account ON powerlink_core.kyc_upload_sessions(account_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_kyc_sessions_expires ON powerlink_core.kyc_upload_sessions(expires_at)
    `);

    // ---------- 4. kyc_documents: link back to session ----------
    await queryRunner.query(`
      ALTER TABLE powerlink_core.kyc_documents
        ADD COLUMN IF NOT EXISTS upload_session_id UUID
          REFERENCES powerlink_core.kyc_upload_sessions(id) ON DELETE SET NULL
    `);

    // ---------- 5. Index for the queue ----------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_kyc_documents_pipeline_status
        ON powerlink_core.kyc_documents(pipeline_status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.idx_kyc_documents_pipeline_status`);
    await queryRunner.query(`
      ALTER TABLE powerlink_core.kyc_documents
        DROP COLUMN IF EXISTS upload_session_id,
        DROP COLUMN IF EXISTS processing_notes,
        DROP COLUMN IF EXISTS scan_result,
        DROP COLUMN IF EXISTS scan_completed_at,
        DROP COLUMN IF EXISTS scan_started_at,
        DROP COLUMN IF EXISTS original_filename,
        DROP COLUMN IF EXISTS mime_type,
        DROP COLUMN IF EXISTS file_size_bytes,
        DROP COLUMN IF EXISTS checksum_sha256,
        DROP COLUMN IF EXISTS quarantine_key,
        DROP COLUMN IF EXISTS storage_key,
        DROP COLUMN IF EXISTS pipeline_status
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS powerlink_core.kyc_upload_sessions`);
    await queryRunner.query(`DROP TYPE IF EXISTS powerlink_core.kyc_pipeline_status`);
  }
}
