import { MigrationInterface, QueryRunner } from 'typeorm';

export class IssuedUniqueExcludesAdjustments1740000000018 implements MigrationInterface {
  name = 'IssuedUniqueExcludesAdjustments1740000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old constraint — it blocked manual adjustments
    await queryRunner.query(`
      DROP INDEX IF EXISTS powerlink_core.uniq_issued_invoice_per_subscription
    `);

    // New index: one outstanding renewal per subscription. Adjustments
    // (prefix 'ADJ-') are exempt because they're additive by design and
    // can stack on top of a renewal.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uniq_issued_invoice_per_subscription
      ON powerlink_core.invoices (subscription_id)
      WHERE status = 'issued' AND invoice_number NOT LIKE 'ADJ-%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.uniq_issued_invoice_per_subscription`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uniq_issued_invoice_per_subscription
      ON powerlink_core.invoices (subscription_id)
      WHERE status = 'issued'
    `);
  }
}
