import { MigrationInterface, QueryRunner } from 'typeorm';

export class OneIssuedInvoicePerSubscription1740000000008 implements MigrationInterface {
  name = 'OneIssuedInvoicePerSubscription1740000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up duplicates first — keep the most recent issued invoice per sub.
    await queryRunner.query(`
      DELETE FROM powerlink_core.invoices i
      USING powerlink_core.invoices j
      WHERE i.subscription_id = j.subscription_id
        AND i.status = 'issued'
        AND j.status = 'issued'
        AND i.issued_at < j.issued_at
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uniq_issued_invoice_per_subscription
      ON powerlink_core.invoices (subscription_id)
      WHERE status = 'issued'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS powerlink_core.uniq_issued_invoice_per_subscription`);
  }
}
