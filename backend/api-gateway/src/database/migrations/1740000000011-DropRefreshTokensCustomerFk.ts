import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRefreshTokensCustomerFk1740000000011 implements MigrationInterface {
  name = 'DropRefreshTokensCustomerFk1740000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the FK by exact name. If it's already gone (e.g. partially applied
    // in a prior run), IF EXISTS makes this a no-op.
    await queryRunner.query(`
      ALTER TABLE powerlink_core.refresh_tokens
        DROP CONSTRAINT IF EXISTS refresh_tokens_customer_id_fkey
    `);

    // Defensive: also drop any FK pointing at powerlink_core.customers by
    // looking it up in the catalog, in case the constraint was renamed.
    const rows: Array<{ conname: string }> = await queryRunner.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'powerlink_core.refresh_tokens'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%REFERENCES powerlink_core.customers%'
    `);

    for (const row of rows) {
      await queryRunner.query(
        `ALTER TABLE powerlink_core.refresh_tokens DROP CONSTRAINT "${row.conname}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE powerlink_core.refresh_tokens
        ADD CONSTRAINT refresh_tokens_customer_id_fkey
        FOREIGN KEY (customer_id) REFERENCES powerlink_core.customers(id) ON DELETE CASCADE
    `);
  }
}
