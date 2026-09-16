import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokensSubjectType1740000000010 implements MigrationInterface {
  name = 'RefreshTokensSubjectType1740000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.refresh_tokens
        ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) NOT NULL DEFAULT 'customer'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_subject
        ON powerlink_core.refresh_tokens(subject_type, customer_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.idx_refresh_tokens_subject`);
    await queryRunner.query(`ALTER TABLE powerlink_core.refresh_tokens DROP COLUMN IF EXISTS subject_type`);
  }
}
