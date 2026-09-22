import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditResourceIdNullable1740000000019 implements MigrationInterface {
  name = 'AuditResourceIdNullable1740000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.audit_logs
        ALTER COLUMN resource_id DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill any nulls with a placeholder before re-adding NOT NULL
    await queryRunner.query(`
      UPDATE powerlink_core.audit_logs
      SET resource_id = '00000000-0000-0000-0000-000000000000'
      WHERE resource_id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE powerlink_core.audit_logs
        ALTER COLUMN resource_id SET NOT NULL
    `);
  }
}
