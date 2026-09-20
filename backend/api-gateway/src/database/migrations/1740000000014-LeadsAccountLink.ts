import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadsAccountLink1740000000014 implements MigrationInterface {
  name = 'LeadsAccountLink1740000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.leads
        ADD COLUMN IF NOT EXISTS account_id UUID
          REFERENCES powerlink_core.accounts(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_account_id
        ON powerlink_core.leads(account_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.idx_leads_account_id`);
    await queryRunner.query(`ALTER TABLE powerlink_core.leads DROP COLUMN IF EXISTS account_id`);
  }
}
