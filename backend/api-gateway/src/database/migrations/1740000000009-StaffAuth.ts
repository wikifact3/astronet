import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffAuth1740000000009 implements MigrationInterface {
  name = 'StaffAuth1740000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.staff_users
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.staff_users
        DROP COLUMN IF EXISTS password_hash,
        DROP COLUMN IF EXISTS failed_login_count,
        DROP COLUMN IF EXISTS locked_until,
        DROP COLUMN IF EXISTS last_password_change_at
    `);
  }
}
