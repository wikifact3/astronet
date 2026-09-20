import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadVerification1740000000015 implements MigrationInterface {
  name = 'LeadVerification1740000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New lead status: needs_review
    await queryRunner.query(`
      ALTER TYPE powerlink_core.lead_status ADD VALUE IF NOT EXISTS 'needs_review'
    `);

    // Verification metadata on leads
    await queryRunner.query(`
      ALTER TABLE powerlink_core.leads
        ADD COLUMN IF NOT EXISTS verified_by UUID,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS promoted_by UUID,
        ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS internal_notes TEXT
    `);

    // New roles: CRM_VERIFIER, AUDITOR
    await queryRunner.query(`
      INSERT INTO powerlink_core.roles (id, name, description)
      VALUES
        (gen_random_uuid(), 'CRM_VERIFIER', 'Verify lead data before promotion; cannot promote'),
        (gen_random_uuid(), 'AUDITOR', 'Read-only access to leads, accounts, and audit logs')
      ON CONFLICT (name) DO NOTHING
    `);

    // New permissions
    await queryRunner.query(`
      INSERT INTO powerlink_core.permissions (resource, action)
      VALUES
        ('leads', 'view'),
        ('leads', 'edit'),
        ('leads', 'verify'),
        ('leads', 'reject'),
        ('leads', 'promote'),
        ('leads', 'delete'),
        ('audit', 'view')
      ON CONFLICT (resource, action) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.leads
        DROP COLUMN IF EXISTS internal_notes,
        DROP COLUMN IF EXISTS promoted_at,
        DROP COLUMN IF EXISTS promoted_by,
        DROP COLUMN IF EXISTS verified_at,
        DROP COLUMN IF EXISTS verified_by
    `);
    await queryRunner.query(`DELETE FROM powerlink_core.roles WHERE name IN ('CRM_VERIFIER', 'AUDITOR')`);
    await queryRunner.query(`
      DELETE FROM powerlink_core.permissions
      WHERE resource = 'leads' OR (resource = 'audit' AND action = 'view')
    `);
    // Note: Postgres does not support removing enum values; the 'needs_review' label
    // stays in the enum but is unused after rollback. Acceptable.
  }
}
